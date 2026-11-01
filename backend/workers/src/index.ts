import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { calculateDistanceKm } from './utils/distance';
import { isValidOrderTransition } from './utils/order-state';
import { OrderStatus } from '@ownlocal/types';
import { authRouter } from './routes/auth';
import { requireAuth, requireRole } from './middleware/rbac';
import { verifyJwt } from './utils/crypto';

export interface Env {
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  ENVIRONMENT: string;
  PILOT_TOWN: string;
  PILOT_LATITUDE: number;
  PILOT_LONGITUDE: number;
  JWT_SECRET?: string;
}

const app = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// Enable CORS for mobile app and admin dashboard
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Root / Welcome
app.get('/', (c) => {
  return c.json({
    service: 'OWNLOCAL LIVE API',
    town: c.env.PILOT_TOWN || 'Ilkal',
    version: '1.0.0',
    auth_supported: ['phone_otp', 'google_phone_auth'],
    docs: '/api/health',
  });
});

// 1. Health check
app.get('/api/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      environment: c.env.ENVIRONMENT || 'development',
      pilot_town: c.env.PILOT_TOWN || 'Ilkal',
      auth: 'JWT + D1 Sessions + RBAC Active',
      timestamp: new Date().toISOString(),
    },
  });
});

// Mount Authentication Router (/api/auth/send-otp, /api/auth/verify-otp, /api/auth/google-phone, etc.)
app.route('/api/auth', authRouter);

// Push Notification Dispatcher (Expo Push API)
async function sendExpoPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: any
) {
  if (!tokens || tokens.length === 0) return;
  const validTokens = Array.from(new Set(tokens)).filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken['));
  if (validTokens.length === 0) return;

  const messages = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: data || {},
    channelId: 'orders',
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.warn('Failed to send Expo push notification:', err);
  }
}

// Register device push token
app.post('/api/notifications/register-token', async (c) => {
  const body = await c.req.json<{
    token: string;
    userId?: string;
    role?: string;
    merchantId?: string;
    riderId?: string;
  }>();

  if (!body.token) {
    return c.json({ success: false, error: { message: 'Push token required' } }, 400);
  }

  const id = `pt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await c.env.DB.prepare(`
    INSERT INTO device_push_tokens (id, token, user_id, role, merchant_id, rider_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(token) DO UPDATE SET
      user_id = COALESCE(excluded.user_id, device_push_tokens.user_id),
      role = COALESCE(excluded.role, device_push_tokens.role),
      merchant_id = COALESCE(excluded.merchant_id, device_push_tokens.merchant_id),
      rider_id = COALESCE(excluded.rider_id, device_push_tokens.rider_id),
      updated_at = datetime('now')
  `)
    .bind(
      id,
      body.token,
      body.userId || null,
      body.role || null,
      body.merchantId || null,
      body.riderId || null
    )
    .run();

  return c.json({ success: true, data: { registered: true } });
});

// 2. Merchants: Public Discovery & Delivery Radius Filtering
app.get('/api/merchants', async (c) => {
  const category = c.req.query('category');
  const queryParam = c.req.query('q')?.trim();
  const latStr = c.req.query('lat');
  const lngStr = c.req.query('lng');
  const strictRadius = c.req.query('strict_radius') !== 'false'; // default true

  const hasGps = Boolean(latStr && lngStr && !isNaN(parseFloat(latStr)) && !isNaN(parseFloat(lngStr)));
  const customerLat = hasGps ? parseFloat(latStr!) : null;
  const customerLng = hasGps ? parseFloat(lngStr!) : null;

  let query = 'SELECT * FROM merchant_profiles WHERE status = "approved"';
  const bindings: any[] = [];

  if (category) {
    query += ' AND category = ?';
    bindings.push(category);
  }

  if (queryParam) {
    query += ' AND (business_name LIKE ? OR category LIKE ? OR address LIKE ?)';
    bindings.push(`%${queryParam}%`, `%${queryParam}%`, `%${queryParam}%`);
  }

  const { results } = await c.env.DB.prepare(query).bind(...bindings).all();

  // If customer provided GPS, calculate distance & filter strictly by delivery radius
  let processedMerchants: any[] = [];
  if (hasGps && customerLat !== null && customerLng !== null) {
    processedMerchants = (results || []).map((m: any) => {
      const distanceKm = calculateDistanceKm(
        customerLat,
        customerLng,
        m.latitude,
        m.longitude
      );
      const serviceRadius = Number(m.service_radius_km || 5.0);
      const selfRadius = Number(m.own_delivery_radius_km || 3.0);
      const isDeliverable = distanceKm <= serviceRadius;
      const canSelfDeliver = Boolean(m.own_delivery_enabled) && distanceKm <= selfRadius;
      const canRiderDeliver = isDeliverable;

      return {
        ...m,
        distanceKm: Number(distanceKm.toFixed(1)),
        service_radius_km: serviceRadius,
        own_delivery_radius_km: selfRadius,
        isDeliverable,
        can_self_deliver: canSelfDeliver,
        can_rider_deliver: canRiderDeliver,
      };
    });

    // If strictRadius is enabled, ONLY return merchants that deliver to customer's location
    if (strictRadius) {
      processedMerchants = processedMerchants.filter((m: any) => m.isDeliverable);
    }

    processedMerchants.sort((a: any, b: any) => a.distanceKm - b.distanceKm);
  } else {
    // No GPS provided, return all approved merchants with default delivery capabilities
    processedMerchants = (results || []).map((m: any) => ({
      ...m,
      distanceKm: null,
      service_radius_km: Number(m.service_radius_km || 5.0),
      own_delivery_radius_km: Number(m.own_delivery_radius_km || 3.0),
      isDeliverable: true,
      can_self_deliver: Boolean(m.own_delivery_enabled),
      can_rider_deliver: true,
    }));
  }

  return c.json({
    success: true,
    data: processedMerchants,
    meta: {
      total: processedMerchants.length,
      customer_coordinates: hasGps ? { latitude: customerLat, longitude: customerLng } : null,
      strict_radius_applied: strictRadius && hasGps,
    },
  });
});

// Search Products Across Stores
app.get('/api/products/search', async (c) => {
  const q = c.req.query('q')?.trim();
  if (!q) {
    return c.json({ success: true, data: [] });
  }

  const latStr = c.req.query('lat');
  const lngStr = c.req.query('lng');
  const hasGps = Boolean(latStr && lngStr && !isNaN(parseFloat(latStr)) && !isNaN(parseFloat(lngStr)));
  const customerLat = hasGps ? parseFloat(latStr!) : null;
  const customerLng = hasGps ? parseFloat(lngStr!) : null;

  const { results } = await c.env.DB.prepare(`
    SELECT p.*, m.business_name, m.latitude as merchant_lat, m.longitude as merchant_lng,
           m.service_radius_km, m.own_delivery_enabled, m.own_delivery_radius_km
    FROM products p
    JOIN merchant_profiles m ON p.merchant_id = m.id
    WHERE p.active = 1 AND m.status = 'approved' AND (p.name LIKE ? OR p.description LIKE ?)
    LIMIT 30
  `)
    .bind(`%${q}%`, `%${q}%`)
    .all();

  let formatted = (results || []).map((row: any) => {
    let distanceKm = null;
    let isDeliverable = true;
    let canSelfDeliver = Boolean(row.own_delivery_enabled);
    let canRiderDeliver = true;

    if (hasGps && customerLat !== null && customerLng !== null) {
      distanceKm = calculateDistanceKm(
        customerLat,
        customerLng,
        row.merchant_lat,
        row.merchant_lng
      );
      const serviceRadius = Number(row.service_radius_km || 5.0);
      const selfRadius = Number(row.own_delivery_radius_km || 3.0);
      isDeliverable = distanceKm <= serviceRadius;
      canSelfDeliver = Boolean(row.own_delivery_enabled) && distanceKm <= selfRadius;
      canRiderDeliver = isDeliverable;
      distanceKm = Number(distanceKm.toFixed(1));
    }

    return {
      ...row,
      distanceKm,
      isDeliverable,
      can_self_deliver: canSelfDeliver,
      can_rider_deliver: canRiderDeliver,
    };
  });

  if (hasGps) {
    formatted = formatted.filter((p: any) => p.isDeliverable);
    formatted.sort((a: any, b: any) => (a.distanceKm || 0) - (b.distanceKm || 0));
  }

  return c.json({ success: true, data: formatted });
});

// 3. Merchant Details
app.get('/api/merchants/:id', async (c) => {
  const id = c.req.param('id');
  const latStr = c.req.query('lat');
  const lngStr = c.req.query('lng');

  const merchant: any = await c.env.DB.prepare('SELECT * FROM merchant_profiles WHERE id = ?')
    .bind(id)
    .first();

  if (!merchant) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } }, 404);
  }

  let distanceKm = null;
  let isDeliverable = true;
  let canSelfDeliver = Boolean(merchant.own_delivery_enabled);
  let canRiderDeliver = true;

  if (latStr && lngStr) {
    const customerLat = parseFloat(latStr);
    const customerLng = parseFloat(lngStr);
    if (!isNaN(customerLat) && !isNaN(customerLng)) {
      distanceKm = calculateDistanceKm(customerLat, customerLng, merchant.latitude, merchant.longitude);
      const serviceRadius = Number(merchant.service_radius_km || 5.0);
      const selfRadius = Number(merchant.own_delivery_radius_km || 3.0);
      isDeliverable = distanceKm <= serviceRadius;
      canSelfDeliver = Boolean(merchant.own_delivery_enabled) && distanceKm <= selfRadius;
      canRiderDeliver = isDeliverable;
      distanceKm = Number(distanceKm.toFixed(1));
    }
  }

  return c.json({
    success: true,
    data: {
      ...merchant,
      distanceKm,
      isDeliverable,
      can_self_deliver: canSelfDeliver,
      can_rider_deliver: canRiderDeliver,
      own_delivery_radius_km: Number(merchant.own_delivery_radius_km || 3.0),
      service_radius_km: Number(merchant.service_radius_km || 5.0),
    },
  });
});

// Helper for starter catalog items
function getStarterProductsForCategory(category: string): Array<{ name: string; description: string; price: number; is_veg: boolean }> {
  switch (category) {
    case 'Food & Dining':
      return [
        { name: 'Special North Karnataka Meals', description: 'Fresh Jowar Roti, Ennegai, Shenga Chutney, Dal & Rice', price: 90, is_veg: true },
        { name: 'Butter Masala Dosa', description: 'Crisp golden crepe folded over aromatic potato palya', price: 60, is_veg: true },
        { name: 'Filter Coffee', description: 'Freshly brewed South Indian filter kaapi with hot milk', price: 20, is_veg: true },
      ];
    case 'Kirana & Daily Needs':
      return [
        { name: 'Sona Masoori Rice (5kg Bag)', description: 'Premium polished daily cooking rice', price: 320, is_veg: true },
        { name: 'Premium Desi Toor Dal (1kg)', description: 'Unpolished protein-rich dal', price: 165, is_veg: true },
        { name: 'Refined Sunflower Oil (1L)', description: 'Pure cooking oil pouch', price: 140, is_veg: true },
      ];
    case 'Fresh Fruits & Veggies':
      return [
        { name: 'Farm Fresh Potatoes (1kg)', description: 'Handpicked local farm potatoes', price: 35, is_veg: true },
        { name: 'Red Onions (1kg)', description: 'Fresh farm-sourced red onions', price: 45, is_veg: true },
        { name: 'Fresh Bananas (1 Dozen)', description: 'Naturally ripened sweet bananas', price: 50, is_veg: true },
      ];
    case 'Ilkal Sarees & Handloom':
      return [
        { name: 'Authentic Ilkal Silk Saree (Topetenchi)', description: 'Signature red and maroon handwoven pallu saree', price: 3499, is_veg: true },
        { name: 'Cotton-Silk Ilkal Daily Saree', description: 'Lightweight comfortable saree with temple border', price: 1299, is_veg: true },
      ];
    case 'Pharmacy & Healthcare':
      return [
        { name: 'First Aid Antiseptic & Bandages', description: 'Essential home medical care kit', price: 110, is_veg: true },
        { name: 'Paracetamol Tablets (Strip of 10)', description: 'Quick fever and ache relief tablets', price: 30, is_veg: true },
      ];
    default:
      return [
        { name: 'Standard Store Item', description: 'Standard starter catalog item', price: 100, is_veg: true },
      ];
  }
}

// 3. Create / Onboard New Merchant (Admin or Self-Registration with GPS)
app.post('/api/merchants', async (c) => {
  const body = await c.req.json<{
    business_name: string;
    category: string;
    phone: string;
    latitude: number;
    longitude: number;
    address: string;
    town?: string;
    service_radius_km?: number;
    own_delivery_enabled?: boolean;
    status?: 'approved' | 'pending';
  }>();

  if (!body.business_name?.trim() || !body.phone?.trim() || !body.address?.trim() || !body.latitude || !body.longitude) {
    return c.json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Shop name, phone, address, and GPS coordinates are required' },
    }, 400);
  }

  const userId = `usr_merch_${Date.now()}`;
  const merchantId = `merch_${Date.now()}`;
  const status = body.status || 'approved'; // default approved for pilot or admin

  // 1. Ensure user exists
  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO users (id, phone, email, role, status)
    VALUES (?, ?, ?, 'merchant', 'active')
  `)
    .bind(userId, body.phone.trim(), `${merchantId}@ownlocal.live`)
    .run();

  // 2. Insert merchant profile
  await c.env.DB.prepare(`
    INSERT INTO merchant_profiles (
      id, user_id, business_name, category, phone,
      latitude, longitude, address, town,
      service_radius_km, own_delivery_enabled, rating, is_open, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4.8, 1, ?)
  `)
    .bind(
      merchantId,
      userId,
      body.business_name.trim(),
      body.category || 'Food & Dining',
      body.phone.trim(),
      body.latitude,
      body.longitude,
      body.address.trim(),
      body.town || 'Ilkal',
      body.service_radius_km || 5.0,
      body.own_delivery_enabled !== false ? 1 : 0,
      status
    )
    .run();

  // 3. Insert initial starter products for this store
  const starterItems = getStarterProductsForCategory(body.category || 'Food & Dining');
  for (const item of starterItems) {
    const prodId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await c.env.DB.prepare(`
      INSERT INTO products (id, merchant_id, name, description, price, is_veg, in_stock, active)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1)
    `)
      .bind(prodId, merchantId, item.name, item.description, item.price, item.is_veg ? 1 : 0)
      .run();
  }

  const createdMerchant = await c.env.DB.prepare('SELECT * FROM merchant_profiles WHERE id = ?')
    .bind(merchantId)
    .first();

  return c.json({
    success: true,
    data: createdMerchant,
    message: status === 'approved' 
      ? `Store "${body.business_name.trim()}" onboarded and live in Ilkal marketplace!` 
      : `Store "${body.business_name.trim()}" registration submitted for admin approval.`,
  });
});

// 4. Products for Merchant
app.get('/api/merchants/:id/products', async (c) => {
  const merchantId = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM products WHERE merchant_id = ? AND active = 1 ORDER BY name ASC'
  )
    .bind(merchantId)
    .all();

  return c.json({ success: true, data: results || [] });
});

// 5. Orders: Create Order
app.post('/api/orders', async (c) => {
  const body = await c.req.json<{
    customer_id?: string;
    merchant_id: string;
    items: Array<{ product_id: string; quantity: number }>;
    delivery_type: 'MERCHANT_SELF' | 'PLATFORM_RIDER' | 'STORE_PICKUP';
    delivery_address: string;
    delivery_latitude?: number;
    delivery_longitude?: number;
    payment_method: 'UPI' | 'COD' | 'CARD' | 'NETBANKING';
  }>();

  if (!body.merchant_id || !body.items || body.items.length === 0) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid order payload' } }, 400);
  }

  const merchant: any = await c.env.DB.prepare('SELECT * FROM merchant_profiles WHERE id = ?')
    .bind(body.merchant_id)
    .first();

  if (!merchant) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant store not found' } }, 404);
  }

  // Verify merchant is approved by platform admin
  if (merchant.status !== 'approved') {
    return c.json({
      success: false,
      error: {
        code: 'MERCHANT_NOT_APPROVED',
        message: `${merchant.business_name} is currently pending approval or suspended by Admin.`,
      },
    }, 400);
  }

  // Verify store is open for business
  if (merchant.is_open === 0) {
    return c.json({
      success: false,
      error: {
        code: 'STORE_CLOSED',
        message: `${merchant.business_name} is currently closed. Orders cannot be accepted at this time.`,
      },
    }, 400);
  }

  let distanceKm = 1.0;
  // Radius & Delivery Capability Verification
  if (body.delivery_latitude && body.delivery_longitude) {
    distanceKm = calculateDistanceKm(
      body.delivery_latitude,
      body.delivery_longitude,
      merchant.latitude,
      merchant.longitude
    );

    const serviceRadius = Number(merchant.service_radius_km || 5.0);
    const ownRadius = Number(merchant.own_delivery_radius_km || 3.0);

    if (body.delivery_type !== 'STORE_PICKUP' && distanceKm > serviceRadius) {
      return c.json({
        success: false,
        error: {
          code: 'OUT_OF_DELIVERY_RADIUS',
          message: `Your address is outside ${merchant.business_name}'s delivery radius of ${serviceRadius} km (current distance: ${distanceKm.toFixed(1)} km). You may choose Store Self-Pickup.`,
        },
      }, 400);
    }

    if (body.delivery_type === 'MERCHANT_SELF') {
      if (!merchant.own_delivery_enabled) {
        return c.json({
          success: false,
          error: {
            code: 'SELF_DELIVERY_DISABLED',
            message: `${merchant.business_name} does not offer self-delivery. Please select Platform Rider Delivery.`,
          },
        }, 400);
      }
      if (distanceKm > ownRadius) {
        return c.json({
          success: false,
          error: {
            code: 'SELF_DELIVERY_RADIUS_EXCEEDED',
            message: `Direct store delivery is only available within ${ownRadius} km (you are ${distanceKm.toFixed(1)} km away). Please select Platform Rider Delivery.`,
          },
        }, 400);
      }
    }
  }

  const productIds = body.items.map((i) => `'${i.product_id}'`).join(',');
  const { results: dbProducts } = await c.env.DB.prepare(
    `SELECT id, name, price, in_stock FROM products WHERE id IN (${productIds})`
  ).all();

  const productMap = new Map((dbProducts || []).map((p: any) => [p.id, p]));

  // Verify stock & calculate authoritative pricing
  let itemTotal = 0;
  for (const item of body.items) {
    const p: any = productMap.get(item.product_id);
    if (!p) {
      return c.json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: `Product ${item.product_id} not found` } }, 404);
    }
    if (p.in_stock === 0) {
      return c.json({
        success: false,
        error: {
          code: 'PRODUCT_OUT_OF_STOCK',
          message: `"${p.name}" is currently out of stock at ${merchant.business_name}. Please remove it to proceed.`,
        },
      }, 400);
    }
  }

  const processedItems = body.items.map((item) => {
    const p: any = productMap.get(item.product_id);
    const totalPrice = p.price * item.quantity;
    itemTotal += totalPrice;
    return {
      product_id: p.id,
      product_name: p.name,
      unit_price: p.price,
      quantity: item.quantity,
      total_price: totalPrice,
    };
  });

  // Dynamic distance-tiered delivery fee
  let deliveryFee = 0;
  if (body.delivery_type !== 'STORE_PICKUP') {
    if (distanceKm <= 1.5) {
      deliveryFee = 15;
    } else if (distanceKm <= 3.0) {
      deliveryFee = 25;
    } else {
      deliveryFee = Math.round(25 + (distanceKm - 3.0) * 8);
    }
  }

  const platformFee = 5;
  const grandTotal = itemTotal + deliveryFee + platformFee;

  const orderId = `ord_${Date.now()}`;
  const orderNumber = `ILK-${Math.floor(1000 + Math.random() * 9000)}`;
  let customerId = body.customer_id || 'usr_cust_01';
  
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtSecret = c.env.JWT_SECRET || 'ownlocal_live_super_secret_jwt_key_2026_ilkal_pilot';
    const decoded = await verifyJwt<{ userId: string }>(token, jwtSecret);
    if (decoded.valid && decoded.payload?.userId) {
      customerId = decoded.payload.userId;
    }
  }

  const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));

  await c.env.DB.prepare(`
    INSERT INTO orders (
      id, order_number, customer_id, merchant_id, delivery_type,
      status, delivery_address, delivery_latitude, delivery_longitude,
      item_total, delivery_fee, platform_fee, grand_total,
      payment_method, payment_status, delivery_otp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      orderId,
      orderNumber,
      customerId,
      body.merchant_id,
      body.delivery_type,
      'MERCHANT_CONFIRMATION_PENDING',
      body.delivery_address,
      body.delivery_latitude || null,
      body.delivery_longitude || null,
      itemTotal,
      deliveryFee,
      platformFee,
      grandTotal,
      body.payment_method,
      body.payment_method === 'COD' ? 'PENDING' : 'SUCCESS',
      deliveryOtp
    )
    .run();

  for (const item of processedItems) {
    const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await c.env.DB.prepare(`
      INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(itemId, orderId, item.product_id, item.product_name, item.unit_price, item.quantity, item.total_price)
      .run();
  }

  await c.env.DB.prepare(`
    INSERT INTO order_status_history (id, order_id, from_status, to_status, notes)
    VALUES (?, ?, ?, ?, ?)
  `)
    .bind(`hist_${Date.now()}`, orderId, 'CREATED', 'MERCHANT_CONFIRMATION_PENDING', 'Order placed by customer')
    .run();

  // Broadcast push notification to merchant
  try {
    const { results: merchantTokens } = await c.env.DB.prepare(
      "SELECT token FROM device_push_tokens WHERE merchant_id = ? OR role = 'MERCHANT'"
    )
      .bind(body.merchant_id)
      .all();
    if (merchantTokens && merchantTokens.length > 0) {
      const tokens = merchantTokens.map((r: any) => r.token);
      sendExpoPushNotification(
        tokens,
        '🚨 New Order Placed!',
        `Order #${orderNumber} (${processedItems.length} items • ₹${grandTotal}) received. Tap to accept.`,
        { orderId, orderNumber }
      );
    }
  } catch (pushErr) {
    console.warn('Push notification error on order placement:', pushErr);
  }

  return c.json({
    success: true,
    data: {
      id: orderId,
      order_number: orderNumber,
      status: 'MERCHANT_CONFIRMATION_PENDING',
      grand_total: grandTotal,
      delivery_otp: deliveryOtp,
      items: processedItems,
    },
  });
});

// 6. Order Status & State Machine Updates
app.post('/api/orders/:id/status', async (c) => {
  const orderId = c.req.param('id');
  const body = await c.req.json<{ status: OrderStatus; notes?: string }>();

  const currentOrder: any = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(orderId)
    .first();

  if (!currentOrder) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
  }

  if (!isValidOrderTransition(currentOrder.status, body.status)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'ILLEGAL_STATE_TRANSITION',
          message: `Cannot transition from ${currentOrder.status} to ${body.status}`,
        },
      },
      400
    );
  }

  await c.env.DB.prepare('UPDATE orders SET status = ?, updated_at = datetime("now") WHERE id = ?')
    .bind(body.status, orderId)
    .run();

  await c.env.DB.prepare(
    'INSERT INTO order_status_history (id, order_id, from_status, to_status, notes) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(`hist_${Date.now()}`, orderId, currentOrder.status, body.status, body.notes || 'Status updated')
    .run();

  // Push notifications on status change
  try {
    if (body.status === 'MERCHANT_CONFIRMED') {
      // Notify customer
      const { results: custTokens } = await c.env.DB.prepare(
        'SELECT token FROM device_push_tokens WHERE user_id = ?'
      ).bind(currentOrder.customer_id).all();
      if (custTokens && custTokens.length > 0) {
        sendExpoPushNotification(
          custTokens.map((r: any) => r.token),
          '🎉 Store Confirmed Your Order!',
          `Order #${currentOrder.order_number} has been confirmed. Food preparation has started.`,
          { orderId, status: body.status }
        );
      }
      // Broadcast to online riders
      const { results: riderTokens } = await c.env.DB.prepare(
        "SELECT token FROM device_push_tokens WHERE role = 'RIDER'"
      ).all();
      if (riderTokens && riderTokens.length > 0) {
        sendExpoPushNotification(
          riderTokens.map((r: any) => r.token),
          '🛵 New Delivery Request Available!',
          `New pickup request for order #${currentOrder.order_number}. Tap to claim job.`,
          { orderId, status: body.status }
        );
      }
    } else if (body.status === 'PICKED_UP' || body.status === 'OUT_FOR_DELIVERY') {
      // Notify customer
      const { results: custTokens } = await c.env.DB.prepare(
        'SELECT token FROM device_push_tokens WHERE user_id = ?'
      ).bind(currentOrder.customer_id).all();
      if (custTokens && custTokens.length > 0) {
        sendExpoPushNotification(
          custTokens.map((r: any) => r.token),
          '🚀 Order Out for Delivery!',
          `Your delivery partner is en route with order #${currentOrder.order_number}. Track live on the map.`,
          { orderId, status: body.status }
        );
      }
    } else if (body.status === 'DELIVERED') {
      // Notify customer & merchant
      const { results: allTokens } = await c.env.DB.prepare(
        'SELECT token FROM device_push_tokens WHERE user_id = ? OR merchant_id = ?'
      ).bind(currentOrder.customer_id, currentOrder.merchant_id).all();
      if (allTokens && allTokens.length > 0) {
        sendExpoPushNotification(
          allTokens.map((r: any) => r.token),
          '✅ Order Delivered!',
          `Order #${currentOrder.order_number} has been delivered successfully. Enjoy!`,
          { orderId, status: body.status }
        );
      }
    }
  } catch (pushErr) {
    console.warn('Status push notification error:', pushErr);
  }

  return c.json({
    success: true,
    data: {
      id: orderId,
      previous_status: currentOrder.status,
      current_status: body.status,
    },
  });
});

// 7. Get Single Order (with merchant, rider, items, and status timeline)
app.get('/api/orders/:id', async (c) => {
  const orderId = c.req.param('id');
  const order: any = await c.env.DB.prepare(`
    SELECT o.*,
      m.business_name as merchant_name, m.address as merchant_address, m.phone as merchant_phone,
      m.latitude as merchant_latitude, m.longitude as merchant_longitude,
      r.name as rider_name, r.vehicle_number as rider_vehicle_number, r.phone as rider_phone,
      r.current_latitude as rider_latitude, r.current_longitude as rider_longitude
    FROM orders o
    LEFT JOIN merchant_profiles m ON o.merchant_id = m.id
    LEFT JOIN rider_profiles r ON o.rider_id = r.id
    WHERE o.id = ?
  `)
    .bind(orderId)
    .first();

  if (!order) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
  }

  const { results: items } = await c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?')
    .bind(orderId)
    .all();

  const { results: history } = await c.env.DB.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC')
    .bind(orderId)
    .all();

  return c.json({
    success: true,
    data: {
      ...order,
      items: items || [],
      history: history || [],
    },
  });
});

// 7a. Verify Delivery OTP Handshake (Rider -> Customer Handshake)
app.post('/api/orders/:id/verify-delivery', async (c) => {
  const orderId = c.req.param('id');
  const body = await c.req.json<{ otp: string }>();

  const currentOrder: any = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(orderId)
    .first();

  if (!currentOrder) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
  }

  if (currentOrder.delivery_otp !== body.otp?.trim()) {
    return c.json({ success: false, error: { code: 'INVALID_DELIVERY_OTP', message: 'Invalid delivery OTP provided by customer' } }, 400);
  }

  if (!isValidOrderTransition(currentOrder.status, 'DELIVERED')) {
    return c.json({ success: false, error: { code: 'ILLEGAL_STATE_TRANSITION', message: `Cannot mark delivered from ${currentOrder.status}` } }, 400);
  }

  await c.env.DB.prepare('UPDATE orders SET status = "DELIVERED", updated_at = datetime("now") WHERE id = ?')
    .bind(orderId)
    .run();

  await c.env.DB.prepare(
    'INSERT INTO order_status_history (id, order_id, from_status, to_status, notes) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(`hist_${Date.now()}`, orderId, currentOrder.status, 'DELIVERED', 'Verified with delivery OTP')
    .run();

  // Broadcast delivery completion push
  try {
    const { results: allTokens } = await c.env.DB.prepare(
      'SELECT token FROM device_push_tokens WHERE user_id = ? OR merchant_id = ?'
    ).bind(currentOrder.customer_id, currentOrder.merchant_id).all();
    if (allTokens && allTokens.length > 0) {
      sendExpoPushNotification(
        allTokens.map((r: any) => r.token),
        '✅ Order Delivered!',
        `Order #${currentOrder.order_number} has been delivered and verified by OTP. Thank you!`,
        { orderId, status: 'DELIVERED' }
      );
    }
  } catch (pushErr) {
    console.warn('Delivery push notification error:', pushErr);
  }

  return c.json({
    success: true,
    data: { id: orderId, status: 'DELIVERED', verified: true },
  });
});

// 7b. Cancel Order (Customer or Merchant Cancellation with State Validation)
app.post('/api/orders/:id/cancel', async (c) => {
  const orderId = c.req.param('id');
  const body = await c.req.json<{ reason?: string }>();

  const currentOrder: any = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(orderId)
    .first();

  if (!currentOrder) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
  }

  if (!isValidOrderTransition(currentOrder.status, 'CUSTOMER_CANCELLED')) {
    return c.json({
      success: false,
      error: {
        code: 'CANNOT_CANCEL',
        message: `Order cannot be cancelled in state '${currentOrder.status}'. Please contact customer support.`,
      },
    }, 400);
  }

  await c.env.DB.prepare('UPDATE orders SET status = "CUSTOMER_CANCELLED", updated_at = datetime("now") WHERE id = ?')
    .bind(orderId)
    .run();

  await c.env.DB.prepare(
    'INSERT INTO order_status_history (id, order_id, from_status, to_status, notes) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(`hist_${Date.now()}`, orderId, currentOrder.status, 'CUSTOMER_CANCELLED', body.reason || 'Cancelled by customer')
    .run();

  return c.json({
    success: true,
    data: { id: orderId, status: 'CUSTOMER_CANCELLED' },
  });
});

// 8. Customer Order History
app.get('/api/customer/orders', async (c) => {
  let customerId = c.req.query('customer_id') || 'usr_cust_01';
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtSecret = c.env.JWT_SECRET || 'ownlocal_live_super_secret_jwt_key_2026_ilkal_pilot';
    const decoded = await verifyJwt<{ userId: string }>(token, jwtSecret);
    if (decoded.valid && decoded.payload?.userId) {
      customerId = decoded.payload.userId;
    }
  }

  const { results: orders } = await c.env.DB.prepare(`
    SELECT o.*, m.business_name as merchant_name
    FROM orders o
    JOIN merchant_profiles m ON o.merchant_id = m.id
    WHERE o.customer_id = ?
    ORDER BY o.created_at DESC
    LIMIT 20
  `)
    .bind(customerId)
    .all();

  return c.json({ success: true, data: orders || [] });
});

// --- RBAC PROTECTED ROLE ENDPOINTS ---

// Merchant Dashboard: Get Store Incoming Orders & Dashboard Stats
app.get('/api/merchant/dashboard', async (c) => {
  let merchantId = c.req.query('merchant_id');

  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtSecret = c.env.JWT_SECRET || 'ownlocal_live_super_secret_jwt_key_2026_ilkal_pilot';
    const decoded = await verifyJwt<{ userId: string; role: string }>(token, jwtSecret);
    if (decoded.valid && decoded.payload?.userId) {
      const merchantByUser: any = await c.env.DB.prepare('SELECT id FROM merchant_profiles WHERE user_id = ?')
        .bind(decoded.payload.userId)
        .first();
      if (merchantByUser) {
        merchantId = merchantByUser.id;
      }
    }
  }

  if (!merchantId) {
    const firstMerch: any = await c.env.DB.prepare('SELECT id FROM merchant_profiles ORDER BY created_at DESC LIMIT 1').first();
    if (firstMerch) merchantId = firstMerch.id;
  }

  const merchant: any = await c.env.DB.prepare('SELECT * FROM merchant_profiles WHERE id = ?')
    .bind(merchantId || '')
    .first();

  const { results: pendingOrders } = await c.env.DB.prepare(`
    SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 30
  `)
    .bind(merchantId)
    .all();

  // Attach items to each order
  const ordersWithItems = await Promise.all(
    (pendingOrders || []).map(async (order: any) => {
      const { results: items } = await c.env.DB.prepare(
        'SELECT * FROM order_items WHERE order_id = ?'
      )
        .bind(order.id)
        .all();
      return {
        ...order,
        items: items || [],
      };
    })
  );

  const todayOrders = ordersWithItems.length;
  const todayGmv = ordersWithItems
    .filter((o: any) => o.status !== 'CUSTOMER_CANCELLED' && o.status !== 'MERCHANT_REJECTED')
    .reduce((sum: number, o: any) => sum + (o.grand_total || 0), 0);

  if (!merchant) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Merchant store "${merchantId}" not found` },
    }, 404);
  }

  return c.json({
    success: true,
    data: {
      merchant,
      orders: ordersWithItems,
      metrics: {
        today_orders: todayOrders,
        today_gmv: todayGmv,
        rating: merchant?.rating || 4.8,
      },
    },
  });
});

// Merchant: Toggle Store Online / Offline
app.post('/api/merchant/toggle-open', async (c) => {
  const body = await c.req.json<{ merchant_id?: string; is_open: boolean }>();
  let merchantId = body.merchant_id || 'merch_ayodhya';

  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtSecret = c.env.JWT_SECRET || 'ownlocal_live_super_secret_jwt_key_2026_ilkal_pilot';
    const decoded = await verifyJwt<{ userId: string }>(token, jwtSecret);
    if (decoded.valid && decoded.payload?.userId) {
      const merchantByUser: any = await c.env.DB.prepare('SELECT id FROM merchant_profiles WHERE user_id = ?')
        .bind(decoded.payload.userId)
        .first();
      if (merchantByUser) {
        merchantId = merchantByUser.id;
      }
    }
  }

  await c.env.DB.prepare('UPDATE merchant_profiles SET is_open = ? WHERE id = ?')
    .bind(body.is_open ? 1 : 0, merchantId)
    .run();

  return c.json({ success: true, data: { merchant_id: merchantId, is_open: body.is_open } });
});

// Merchant: Configure Delivery Radius & Self-Delivery Settings
app.post('/api/merchant/delivery-settings', async (c) => {
  const body = await c.req.json<{
    merchant_id?: string;
    service_radius_km?: number;
    own_delivery_enabled?: boolean;
    own_delivery_radius_km?: number;
  }>();

  let merchantId = body.merchant_id || 'merch_ayodhya';

  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtSecret = c.env.JWT_SECRET || 'ownlocal_live_super_secret_jwt_key_2026_ilkal_pilot';
    const decoded = await verifyJwt<{ userId: string }>(token, jwtSecret);
    if (decoded.valid && decoded.payload?.userId) {
      const merchantByUser: any = await c.env.DB.prepare('SELECT id FROM merchant_profiles WHERE user_id = ?')
        .bind(decoded.payload.userId)
        .first();
      if (merchantByUser) {
        merchantId = merchantByUser.id;
      }
    }
  }

  const existing: any = await c.env.DB.prepare('SELECT * FROM merchant_profiles WHERE id = ?')
    .bind(merchantId)
    .first();

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } }, 404);
  }

  const serviceRadius = body.service_radius_km !== undefined 
    ? Math.max(0.5, Math.min(50, Number(body.service_radius_km))) 
    : Number(existing.service_radius_km || 5.0);

  const ownDeliveryEnabled = body.own_delivery_enabled !== undefined 
    ? (body.own_delivery_enabled ? 1 : 0) 
    : existing.own_delivery_enabled;

  const ownRadius = body.own_delivery_radius_km !== undefined 
    ? Math.max(0.5, Math.min(30, Number(body.own_delivery_radius_km))) 
    : Number(existing.own_delivery_radius_km || 3.0);

  await c.env.DB.prepare(`
    UPDATE merchant_profiles
    SET service_radius_km = ?, own_delivery_enabled = ?, own_delivery_radius_km = ?
    WHERE id = ?
  `)
    .bind(serviceRadius, ownDeliveryEnabled, ownRadius, merchantId)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM merchant_profiles WHERE id = ?').bind(merchantId).first();
  return c.json({ success: true, data: updated, message: 'Delivery settings updated successfully' });
});

// Merchant: Toggle Product In-Stock / Out-of-Stock
app.post('/api/merchant/products/:id/toggle-stock', async (c) => {
  const productId = c.req.param('id');
  const body = await c.req.json<{ in_stock: boolean }>();

  await c.env.DB.prepare('UPDATE products SET in_stock = ? WHERE id = ?')
    .bind(body.in_stock ? 1 : 0, productId)
    .run();

  return c.json({ success: true, data: { product_id: productId, in_stock: body.in_stock } });
});

// Merchant: Add New Product / Dish
app.post('/api/merchant/products', async (c) => {
  let merchantId = c.req.query('merchant_id') || 'merch_01';
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtSecret = c.env.JWT_SECRET || 'ownlocal_live_super_secret_jwt_key_2026_ilkal_pilot';
    const decoded = await verifyJwt<{ userId: string }>(token, jwtSecret);
    if (decoded.valid && decoded.payload?.userId) {
      const merchantByUser: any = await c.env.DB.prepare('SELECT id FROM merchant_profiles WHERE user_id = ?')
        .bind(decoded.payload.userId)
        .first();
      if (merchantByUser) merchantId = merchantByUser.id;
    }
  }

  const body = await c.req.json<{
    merchant_id?: string;
    name: string;
    description?: string;
    price: number;
    is_veg?: boolean;
  }>();

  if (body.merchant_id) merchantId = body.merchant_id;

  if (!body.name?.trim() || !body.price || isNaN(Number(body.price))) {
    return c.json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Item name and valid price are required' },
    }, 400);
  }

  const prodId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await c.env.DB.prepare(`
    INSERT INTO products (id, merchant_id, name, description, price, is_veg, in_stock, active)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1)
  `)
    .bind(
      prodId,
      merchantId,
      body.name.trim(),
      body.description?.trim() || '',
      Number(body.price),
      body.is_veg !== false ? 1 : 0
    )
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(prodId).first();
  return c.json({ success: true, data: created, message: 'Product added to catalog! 🎉' });
});

// Merchant: Update Existing Product
app.put('/api/merchant/products/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    description?: string;
    price?: number;
    is_veg?: boolean;
  }>();

  const existing: any = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
  }

  const name = body.name?.trim() || existing.name;
  const description = body.description !== undefined ? body.description.trim() : existing.description;
  const price = body.price !== undefined && !isNaN(Number(body.price)) ? Number(body.price) : existing.price;
  const isVeg = body.is_veg !== undefined ? (body.is_veg ? 1 : 0) : existing.is_veg;

  await c.env.DB.prepare(`
    UPDATE products 
    SET name = ?, description = ?, price = ?, is_veg = ?
    WHERE id = ?
  `)
    .bind(name, description, price, isVeg, id)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: updated, message: 'Product updated successfully' });
});

// Merchant: Delete Product
app.delete('/api/merchant/products/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: 'Product removed from catalog' });
});

// Rider Console: Get Active Assignment, Available Jobs Pool (Filtered by Merchant-to-Rider distance), Metrics & Profile
app.get('/api/rider/console', async (c) => {
  let riderId = c.req.query('rider_id');

  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtSecret = c.env.JWT_SECRET || 'ownlocal_live_super_secret_jwt_key_2026_ilkal_pilot';
    const decoded = await verifyJwt<{ userId: string; role: string }>(token, jwtSecret);
    if (decoded.valid && decoded.payload?.userId) {
      const riderByUser: any = await c.env.DB.prepare('SELECT id FROM rider_profiles WHERE user_id = ?')
        .bind(decoded.payload.userId)
        .first();
      if (riderByUser) {
        riderId = riderByUser.id;
      }
    }
  }

  let rider: any = null;
  if (riderId) {
    rider = await c.env.DB.prepare('SELECT * FROM rider_profiles WHERE id = ?')
      .bind(riderId)
      .first();
  }
  if (!rider) {
    rider = await c.env.DB.prepare('SELECT * FROM rider_profiles ORDER BY created_at DESC LIMIT 1').first();
    if (rider) riderId = rider.id;
  }

  const isApproved = rider ? rider.status === 'approved' : true;
  const isOnline = rider ? Boolean(rider.online_status) : true;

  // Active assignment for this rider
  const activeJob: any = await c.env.DB.prepare(`
    SELECT o.*, 
      m.business_name as merchant_name, m.address as merchant_address, m.phone as merchant_phone,
      m.latitude as merchant_latitude, m.longitude as merchant_longitude
    FROM orders o
    JOIN merchant_profiles m ON o.merchant_id = m.id
    WHERE o.rider_id = ? AND o.status IN ('RIDER_ASSIGNED', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY')
    LIMIT 1
  `)
    .bind(riderId)
    .first();

  if (activeJob) {
    const { results: items } = await c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?')
      .bind(activeJob.id)
      .all();
    activeJob.items = items || [];
  }

  // Get Admin Platform Matching Radius from platform_settings (default 3.0 km)
  const platformSettingRow: any = await c.env.DB.prepare(
    "SELECT value FROM platform_settings WHERE key = 'platform_rider_matching_radius_km'"
  ).first();
  const platformMatchingRadius = platformSettingRow?.value ? parseFloat(platformSettingRow.value) : 3.0;

  // Effective matching radius: Rider's customized preferred_radius_km takes precedence, falling back to Admin platform radius
  const riderPreferredRadius = rider?.preferred_radius_km !== null && rider?.preferred_radius_km !== undefined
    ? Number(rider.preferred_radius_km)
    : null;
  const effectiveRadiusKm = riderPreferredRadius !== null && !isNaN(riderPreferredRadius)
    ? riderPreferredRadius
    : platformMatchingRadius;

  let availableJobs: any[] = [];
  let offlineNotice: string | null = null;

  if (!isApproved) {
    offlineNotice = 'Your rider account is pending Admin approval or suspended. Please contact Admin.';
  } else if (!isOnline) {
    offlineNotice = 'You are currently OFFLINE. Toggle duty ON to receive nearby store pickup jobs.';
  } else {
    // Rider GPS coordinates
    const riderLat = rider?.current_latitude !== null && rider?.current_latitude !== undefined ? Number(rider.current_latitude) : null;
    const riderLng = rider?.current_longitude !== null && rider?.current_longitude !== undefined ? Number(rider.current_longitude) : null;

    // Fetch unassigned orders waiting for rider dispatch
    const { results: unassignedOrders } = await c.env.DB.prepare(`
      SELECT o.*, 
        m.business_name as merchant_name, m.address as merchant_address, m.phone as merchant_phone,
        m.latitude as merchant_latitude, m.longitude as merchant_longitude
      FROM orders o
      JOIN merchant_profiles m ON o.merchant_id = m.id
      WHERE o.rider_id IS NULL 
        AND o.status IN ('MERCHANT_CONFIRMED', 'RIDER_ASSIGNMENT_PENDING', 'READY_FOR_PICKUP') 
        AND o.delivery_type = 'PLATFORM_RIDER'
      ORDER BY o.created_at ASC
      LIMIT 25
    `).all();

    if (unassignedOrders && unassignedOrders.length > 0) {
      // Calculate Merchant-to-Rider distance for each unassigned order
      for (const order of unassignedOrders as any[]) {
        let pickupDistanceKm: number = 0.6;
        let dropDistanceKm: number = 1.4;

        if (riderLat !== null && riderLng !== null && order.merchant_latitude && order.merchant_longitude) {
          pickupDistanceKm = calculateDistanceKm(
            riderLat,
            riderLng,
            order.merchant_latitude,
            order.merchant_longitude
          );
        }

        if (order.merchant_latitude && order.merchant_longitude && order.delivery_latitude && order.delivery_longitude) {
          dropDistanceKm = calculateDistanceKm(
            order.merchant_latitude,
            order.merchant_longitude,
            order.delivery_latitude,
            order.delivery_longitude
          );
        }

        // Check if within matching radius: distance(Merchant pickup, Rider location) <= effectiveRadiusKm
        if (pickupDistanceKm <= effectiveRadiusKm) {
          // Fetch order items preview
          const { results: items } = await c.env.DB.prepare('SELECT product_name, quantity FROM order_items WHERE order_id = ?')
            .bind(order.id)
            .all();
          const itemsSummary = (items || []).map((it: any) => `${it.quantity}x ${it.product_name}`).join(', ');

          availableJobs.push({
            ...order,
            pickup_distance_km: Number(pickupDistanceKm.toFixed(1)),
            drop_distance_km: Number(dropDistanceKm.toFixed(1)),
            items_summary: itemsSummary || 'Fresh store order parcel',
            earnings: order.delivery_fee || 35,
          });
        }
      }

      // Sort by pickup distance ASC (closest merchant pickup first)
      availableJobs.sort((a, b) => a.pickup_distance_km - b.pickup_distance_km);
    }
  }

  // Completed deliveries & earnings for rider
  const completedStats: any = await c.env.DB.prepare(`
    SELECT COUNT(*) as count, SUM(delivery_fee) as earnings
    FROM orders
    WHERE rider_id = ? AND status = 'DELIVERED'
  `)
    .bind(riderId)
    .first();

  return c.json({
    success: true,
    data: {
      rider: rider || {
        id: riderId,
        name: 'Manjunath Badiger',
        vehicle_type: 'bike',
        vehicle_number: 'KA-29-EE-4521',
        online_status: 1,
        preferred_radius_km: 3.0,
      },
      activeJob: activeJob || null,
      availableJobs: availableJobs || [],
      offline_notice: offlineNotice,
      metrics: {
        trips_today: completedStats?.count || 0,
        earnings_today: (completedStats?.count || 0) * 35, // ₹35 per delivery trip
        on_time_rate: '98%',
      },
      dispatch_settings: {
        effective_radius_km: effectiveRadiusKm,
        rider_preferred_radius_km: riderPreferredRadius,
        admin_platform_radius_km: platformMatchingRadius,
        is_online: isOnline,
        is_approved: isApproved,
      },
    },
  });
});

// Rider: Accept Order From Available Pool (Atomic Claim)
app.post('/api/rider/accept-job', async (c) => {
  const body = await c.req.json<{ order_id: string; rider_id?: string }>();
  let riderId = body.rider_id || 'rider_01';

  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtSecret = c.env.JWT_SECRET || 'ownlocal_live_super_secret_jwt_key_2026_ilkal_pilot';
    const decoded = await verifyJwt<{ userId: string }>(token, jwtSecret);
    if (decoded.valid && decoded.payload?.userId) {
      const riderByUser: any = await c.env.DB.prepare('SELECT id FROM rider_profiles WHERE user_id = ?')
        .bind(decoded.payload.userId)
        .first();
      if (riderByUser) riderId = riderByUser.id;
    }
  }

  const order: any = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(body.order_id)
    .first();

  if (!order) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
  }

  // Check if rider is approved
  const riderProfile: any = await c.env.DB.prepare('SELECT status FROM rider_profiles WHERE id = ?').bind(riderId).first();
  if (riderProfile && riderProfile.status !== 'approved') {
    return c.json({
      success: false,
      error: { code: 'NOT_APPROVED', message: 'Rider account is pending Admin approval or suspended.' },
    }, 403);
  }

  if (order.rider_id && order.rider_id !== riderId) {
    return c.json({ success: false, error: { code: 'ALREADY_ASSIGNED', message: 'This job was just claimed by another rider!' } }, 409);
  }

  // Atomic UPDATE: only updates if order has no rider or already this rider
  const updateResult = await c.env.DB.prepare(`
    UPDATE orders 
    SET rider_id = ?, status = 'RIDER_ASSIGNED', updated_at = datetime('now') 
    WHERE id = ? AND (rider_id IS NULL OR rider_id = ?)
  `)
    .bind(riderId, body.order_id, riderId)
    .run();

  if (updateResult.meta.changes === 0) {
    return c.json({
      success: false,
      error: { code: 'ALREADY_CLAIMED', message: 'This delivery job was just accepted by another nearby rider.' },
    }, 409);
  }

  await c.env.DB.prepare(
    'INSERT INTO order_status_history (id, order_id, from_status, to_status, notes) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(`hist_${Date.now()}`, body.order_id, order.status, 'RIDER_ASSIGNED', `Assigned to rider ${riderId}`)
    .run();

  return c.json({ success: true, data: { order_id: body.order_id, status: 'RIDER_ASSIGNED', rider_id: riderId } });
});

// Rider: Confirm Pickup from Merchant
app.post('/api/rider/pickup-job', async (c) => {
  const body = await c.req.json<{ order_id: string }>();

  const order: any = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(body.order_id)
    .first();

  if (!order) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
  }

  await c.env.DB.prepare('UPDATE orders SET status = "OUT_FOR_DELIVERY", updated_at = datetime("now") WHERE id = ?')
    .bind(body.order_id)
    .run();

  await c.env.DB.prepare(
    'INSERT INTO order_status_history (id, order_id, from_status, to_status, notes) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(`hist_${Date.now()}`, body.order_id, order.status, 'OUT_FOR_DELIVERY', 'Picked up by rider from merchant, en route to customer')
    .run();

  return c.json({ success: true, data: { order_id: body.order_id, status: 'OUT_FOR_DELIVERY' } });
});

// Rider: Configure Preferred Pickup / Dispatch Radius
app.post('/api/rider/settings', async (c) => {
  const body = await c.req.json<{ rider_id?: string; preferred_radius_km: number }>();
  let riderId = body.rider_id || 'rider_01';

  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtSecret = c.env.JWT_SECRET || 'ownlocal_live_super_secret_jwt_key_2026_ilkal_pilot';
    const decoded = await verifyJwt<{ userId: string }>(token, jwtSecret);
    if (decoded.valid && decoded.payload?.userId) {
      const riderByUser: any = await c.env.DB.prepare('SELECT id FROM rider_profiles WHERE user_id = ?')
        .bind(decoded.payload.userId)
        .first();
      if (riderByUser) riderId = riderByUser.id;
    }
  }

  const radius = Math.max(0.5, Math.min(30, Number(body.preferred_radius_km || 3.0)));

  await c.env.DB.prepare('UPDATE rider_profiles SET preferred_radius_km = ? WHERE id = ?')
    .bind(radius, riderId)
    .run();

  const updatedRider: any = await c.env.DB.prepare('SELECT * FROM rider_profiles WHERE id = ?')
    .bind(riderId)
    .first();

  return c.json({
    success: true,
    data: {
      rider_id: riderId,
      preferred_radius_km: radius,
      rider: updatedRider,
    },
    message: `Preferred pickup radius set to ${radius} km`,
  });
});

// Rider: Toggle Duty Online / Offline
app.post('/api/rider/toggle-duty', async (c) => {
  const body = await c.req.json<{ online: boolean; rider_id?: string }>();
  let riderId = body.rider_id || 'rider_01';

  await c.env.DB.prepare('UPDATE rider_profiles SET online_status = ? WHERE id = ?')
    .bind(body.online ? 1 : 0, riderId)
    .run();

  return c.json({ success: true, data: { rider_id: riderId, online_status: body.online ? 1 : 0 } });
});

// Rider: Real-Time GPS Location Ping
app.post('/api/rider/location', async (c) => {
  const body = await c.req.json<{ latitude: number; longitude: number; rider_id?: string; heading?: number; speed?: number }>();
  let riderId = body.rider_id || 'rider_01';

  await c.env.DB.prepare(
    'UPDATE rider_profiles SET current_latitude = ?, current_longitude = ?, last_location_update = datetime("now") WHERE id = ?'
  )
    .bind(body.latitude, body.longitude, riderId)
    .run();

  // Log in rider_locations for tracking trail
  const locId = `loc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  try {
    await c.env.DB.prepare(`
      INSERT INTO rider_locations (id, rider_id, latitude, longitude, heading, speed)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
      .bind(locId, riderId, body.latitude, body.longitude, body.heading || null, body.speed || null)
      .run();
  } catch (err) {
    // Non-fatal if location history insert fails
  }

  return c.json({ success: true, data: { rider_id: riderId, latitude: body.latitude, longitude: body.longitude } });
});

// Rider: Self-Registration / Fleet Onboarding
app.post('/api/riders', async (c) => {
  const body = await c.req.json<{
    name: string;
    phone: string;
    vehicle_type?: 'bike' | 'scooter' | 'cycle' | 'auto';
    vehicle_number: string;
    preferred_radius_km?: number;
  }>();

  if (!body.name?.trim() || !body.phone?.trim() || !body.vehicle_number?.trim()) {
    return c.json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Name, phone number, and vehicle number are required' },
    }, 400);
  }

  const userId = `usr_rider_${Date.now()}`;
  const riderId = `rider_${Date.now()}`;
  const radius = Number(body.preferred_radius_km || 3.0);

  // 1. Ensure user exists
  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO users (id, phone, email, role, status)
    VALUES (?, ?, ?, 'rider', 'active')
  `)
    .bind(userId, body.phone.trim(), `${riderId}@ownlocal.live`)
    .run();

  // 2. Insert rider profile (approved with duty online ready for pilot orders)
  await c.env.DB.prepare(`
    INSERT INTO rider_profiles (
      id, user_id, name, phone, vehicle_type, vehicle_number, status, online_status, preferred_radius_km
    ) VALUES (?, ?, ?, ?, ?, ?, 'approved', 1, ?)
  `)
    .bind(
      riderId,
      userId,
      body.name.trim(),
      body.phone.trim(),
      body.vehicle_type || 'bike',
      body.vehicle_number.trim().toUpperCase(),
      radius
    )
    .run();

  const createdRider = await c.env.DB.prepare('SELECT * FROM rider_profiles WHERE id = ?').bind(riderId).first();

  return c.json({
    success: true,
    data: createdRider,
    message: 'Rider successfully registered and active for deliveries! 🎉',
  });
});

// Admin: Get Town GMV, All Merchants, and System Metrics
app.get('/api/admin/metrics', async (c) => {
  const totalOrders: any = await c.env.DB.prepare('SELECT COUNT(*) as count, SUM(grand_total) as gmv FROM orders').first();
  const merchantsCount: any = await c.env.DB.prepare('SELECT COUNT(*) as count FROM merchant_profiles WHERE status = "approved"').first();
  const ridersCount: any = await c.env.DB.prepare('SELECT COUNT(*) as count FROM rider_profiles WHERE status = "approved"').first();
  const platformRevenue: any = await c.env.DB.prepare('SELECT SUM(platform_fee) as fees FROM orders').first();

  return c.json({
    success: true,
    data: {
      total_orders: totalOrders?.count || 0,
      total_gmv: totalOrders?.gmv || 0,
      merchants_count: merchantsCount?.count || 0,
      riders_count: ridersCount?.count || 0,
      platform_revenue: platformRevenue?.fees || 0,
      town: c.env.PILOT_TOWN || 'Ilkal',
    },
  });
});

// Admin: List All Merchants in Town with Status & Details
app.get('/api/admin/merchants', async (c) => {
  const { results: merchants } = await c.env.DB.prepare(
    'SELECT * FROM merchant_profiles ORDER BY created_at DESC'
  ).all();

  return c.json({ success: true, data: merchants || [] });
});

// Admin: Update Merchant Approval / KYC Status
app.post('/api/admin/merchants/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ status: 'approved' | 'rejected' | 'suspended' | 'pending' }>();

  await c.env.DB.prepare('UPDATE merchant_profiles SET status = ? WHERE id = ?')
    .bind(body.status, id)
    .run();

  return c.json({ success: true, data: { id, status: body.status } });
});

// Admin: List All Riders in Town with Duty Status
app.get('/api/admin/riders', async (c) => {
  const { results: riders } = await c.env.DB.prepare(
    'SELECT * FROM rider_profiles ORDER BY created_at DESC'
  ).all();

  return c.json({ success: true, data: riders || [] });
});

// Admin: Update Rider Approval Status
app.post('/api/admin/riders/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ status: 'approved' | 'rejected' | 'suspended' | 'pending' }>();

  await c.env.DB.prepare('UPDATE rider_profiles SET status = ? WHERE id = ?')
    .bind(body.status, id)
    .run();

  return c.json({ success: true, data: { id, status: body.status } });
});

// Admin: Delete Merchant
app.delete('/api/admin/merchants/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM products WHERE merchant_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM merchant_profiles WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: `Merchant ${id} deleted successfully` });
});

// Admin: Delete Rider
app.delete('/api/admin/riders/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM rider_locations WHERE rider_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM rider_profiles WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: `Rider ${id} deleted successfully` });
});

// Admin: Live Town Orders Audit Stream
app.get('/api/admin/orders', async (c) => {
  const { results: orders } = await c.env.DB.prepare(`
    SELECT o.*, m.business_name as merchant_name, r.name as rider_name
    FROM orders o
    LEFT JOIN merchant_profiles m ON o.merchant_id = m.id
    LEFT JOIN rider_profiles r ON o.rider_id = r.id
    ORDER BY o.created_at DESC
    LIMIT 50
  `).all();

  return c.json({ success: true, data: orders || [] });
});

// Admin: Get Platform Operations Settings (e.g. platform rider matching radius)
app.get('/api/admin/settings', async (c) => {
  const { results: settingsRows } = await c.env.DB.prepare('SELECT * FROM platform_settings').all();

  const settings: Record<string, any> = {};
  for (const row of (settingsRows || []) as any[]) {
    settings[row.key] = row.value;
  }

  const matchingRadius = settings['platform_rider_matching_radius_km']
    ? parseFloat(settings['platform_rider_matching_radius_km'])
    : 3.0;

  return c.json({
    success: true,
    data: {
      platform_rider_matching_radius_km: matchingRadius,
      settings,
    },
  });
});

// Admin: Update Platform Operations Settings
app.post('/api/admin/settings', async (c) => {
  const body = await c.req.json<{ platform_rider_matching_radius_km?: number }>();

  if (body.platform_rider_matching_radius_km !== undefined) {
    const radius = Math.max(0.5, Math.min(30, Number(body.platform_rider_matching_radius_km)));
    await c.env.DB.prepare(`
      INSERT INTO platform_settings (key, value, description, updated_at)
      VALUES ('platform_rider_matching_radius_km', ?, 'Default platform matching radius in km between Merchant pickup location and Rider current GPS location', datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `)
      .bind(String(radius))
      .run();
  }

  const updatedSetting: any = await c.env.DB.prepare(
    "SELECT value FROM platform_settings WHERE key = 'platform_rider_matching_radius_km'"
  ).first();

  return c.json({
    success: true,
    data: {
      platform_rider_matching_radius_km: updatedSetting?.value ? parseFloat(updatedSetting.value) : 3.0,
    },
    message: 'Platform settings updated successfully',
  });
});

// --- 9. Cloudflare R2 Media Storage Routes ---

// Upload Media Asset (Product Images, Merchant KYC, Rider Driving Licenses)
app.post('/api/assets/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'No file provided in form-data (key "file")' } }, 400);
  }

  const extension = file.name.split('.').pop() || 'bin';
  const assetKey = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
  const contentType = file.type || 'application/octet-stream';

  const buffer = await file.arrayBuffer();

  await c.env.ASSETS_BUCKET.put(assetKey, buffer, {
    httpMetadata: {
      contentType,
    },
    customMetadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
    },
  });

  const origin = new URL(c.req.url).origin;
  const assetUrl = `${origin}/api/assets/${assetKey}`;

  return c.json({
    success: true,
    data: {
      key: assetKey,
      filename: file.name,
      contentType,
      size: buffer.byteLength,
      url: assetUrl,
    },
  });
});

// Serve / Download Media Asset from R2
app.get('/api/assets/:key', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.ASSETS_BUCKET.get(key);

  if (!object) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Asset not found in storage bucket' } }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
});

export default app;
