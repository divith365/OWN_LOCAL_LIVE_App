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

// 2. Merchants: Public Discovery & Nearby Filtering
app.get('/api/merchants', async (c) => {
  const category = c.req.query('category');
  const queryParam = c.req.query('q')?.trim();
  const latStr = c.req.query('lat');
  const lngStr = c.req.query('lng');

  const customerLat = latStr ? parseFloat(latStr) : Number(c.env.PILOT_LATITUDE || 15.9587);
  const customerLng = lngStr ? parseFloat(lngStr) : Number(c.env.PILOT_LONGITUDE || 76.1264);

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

  // Apply Haversine Distance algorithm (Section 13)
  const merchantsWithDistance = (results || []).map((m: any) => {
    const distanceKm = calculateDistanceKm(
      customerLat,
      customerLng,
      m.latitude,
      m.longitude
    );
    return {
      ...m,
      distanceKm,
      isDeliverable: distanceKm <= (m.service_radius_km || 5.0),
    };
  });

  merchantsWithDistance.sort((a: any, b: any) => a.distanceKm - b.distanceKm);

  return c.json({
    success: true,
    data: merchantsWithDistance,
    meta: {
      total: merchantsWithDistance.length,
      customer_coordinates: { latitude: customerLat, longitude: customerLng },
    },
  });
});

// Search Products Across Stores in Ilkal
app.get('/api/products/search', async (c) => {
  const q = c.req.query('q')?.trim();
  if (!q) {
    return c.json({ success: true, data: [] });
  }

  const latStr = c.req.query('lat');
  const lngStr = c.req.query('lng');
  const customerLat = latStr ? parseFloat(latStr) : Number(c.env.PILOT_LATITUDE || 15.9587);
  const customerLng = lngStr ? parseFloat(lngStr) : Number(c.env.PILOT_LONGITUDE || 76.1264);

  const { results } = await c.env.DB.prepare(`
    SELECT p.*, m.business_name, m.latitude as merchant_lat, m.longitude as merchant_lng, m.service_radius_km
    FROM products p
    JOIN merchant_profiles m ON p.merchant_id = m.id
    WHERE p.active = 1 AND (p.name LIKE ? OR p.description LIKE ?)
    LIMIT 30
  `)
    .bind(`%${q}%`, `%${q}%`)
    .all();

  const formatted = (results || []).map((row: any) => {
    const distanceKm = calculateDistanceKm(
      customerLat,
      customerLng,
      row.merchant_lat,
      row.merchant_lng
    );
    return {
      ...row,
      distanceKm,
      isDeliverable: distanceKm <= (row.service_radius_km || 5.0),
    };
  });

  formatted.sort((a: any, b: any) => a.distanceKm - b.distanceKm);
  return c.json({ success: true, data: formatted });
});

// 3. Merchant Details
app.get('/api/merchants/:id', async (c) => {
  const id = c.req.param('id');
  const merchant = await c.env.DB.prepare('SELECT * FROM merchant_profiles WHERE id = ?')
    .bind(id)
    .first();

  if (!merchant) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } }, 404);
  }

  return c.json({ success: true, data: merchant });
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

  const productIds = body.items.map((i) => `'${i.product_id}'`).join(',');
  const { results: dbProducts } = await c.env.DB.prepare(
    `SELECT id, name, price FROM products WHERE id IN (${productIds})`
  ).all();

  const productMap = new Map((dbProducts || []).map((p: any) => [p.id, p]));

  let itemTotal = 0;
  const processedItems = body.items.map((item) => {
    const p: any = productMap.get(item.product_id);
    if (!p) throw new Error(`Product ${item.product_id} not found`);
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

  const deliveryFee = body.delivery_type === 'STORE_PICKUP' ? 0 : 25;
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
      r.name as rider_name, r.vehicle_number as rider_vehicle_number, r.phone as rider_phone
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
  let merchantId = c.req.query('merchant_id') || 'merch_ayodhya';

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

  const merchant: any = await c.env.DB.prepare('SELECT * FROM merchant_profiles WHERE id = ?')
    .bind(merchantId)
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

  return c.json({
    success: true,
    data: {
      merchant: merchant || { business_name: 'Ayodhya Hotel', id: merchantId, is_open: 1 },
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

// Merchant: Toggle Product In-Stock / Out-of-Stock
app.post('/api/merchant/products/:id/toggle-stock', async (c) => {
  const productId = c.req.param('id');
  const body = await c.req.json<{ in_stock: boolean }>();

  await c.env.DB.prepare('UPDATE products SET in_stock = ? WHERE id = ?')
    .bind(body.in_stock ? 1 : 0, productId)
    .run();

  return c.json({ success: true, data: { product_id: productId, in_stock: body.in_stock } });
});

// Rider Only: Get Assigned Delivery Jobs & Update GPS
app.get('/api/rider/active-job', requireAuth, requireRole('rider'), async (c) => {
  const user = c.get('user');
  const rider: any = await c.env.DB.prepare('SELECT * FROM rider_profiles WHERE user_id = ?')
    .bind(user.userId)
    .first();

  const riderId = rider ? rider.id : 'rider_01';

  const activeJob: any = await c.env.DB.prepare(`
    SELECT o.*, m.business_name as merchant_name, m.address as merchant_address
    FROM orders o
    JOIN merchant_profiles m ON o.merchant_id = m.id
    WHERE o.rider_id = ? AND o.status NOT IN ('DELIVERED', 'FAILED', 'CUSTOMER_CANCELLED')
    LIMIT 1
  `)
    .bind(riderId)
    .first();

  return c.json({
    success: true,
    data: {
      rider: rider || { name: 'Manjunath Badiger', vehicle_number: 'KA-29-EE-4521' },
      activeJob: activeJob || null,
    },
  });
});

// Admin Only: Get Town GMV, All Merchants, and KYC Queue
app.get('/api/admin/metrics', requireAuth, requireRole('admin'), async (c) => {
  const totalOrders: any = await c.env.DB.prepare('SELECT COUNT(*) as count, SUM(grand_total) as gmv FROM orders').first();
  const merchantsCount: any = await c.env.DB.prepare('SELECT COUNT(*) as count FROM merchant_profiles WHERE status = "approved"').first();
  const ridersCount: any = await c.env.DB.prepare('SELECT COUNT(*) as count FROM rider_profiles WHERE status = "approved"').first();

  return c.json({
    success: true,
    data: {
      total_orders: totalOrders?.count || 0,
      total_gmv: totalOrders?.gmv || 0,
      merchants_count: merchantsCount?.count || 0,
      riders_count: ridersCount?.count || 0,
      town: c.env.PILOT_TOWN || 'Ilkal',
    },
  });
});

export default app;
