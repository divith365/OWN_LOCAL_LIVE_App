import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { calculateDistanceKm } from './utils/distance';
import { isValidOrderTransition } from './utils/order-state';
import { OrderStatus } from '@ownlocal/types';
import { authRouter } from './routes/auth';
import { requireAuth, requireRole } from './middleware/rbac';

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
  const customerId = body.customer_id || 'usr_cust_01';
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

// 7. Get Single Order
app.get('/api/orders/:id', async (c) => {
  const orderId = c.req.param('id');
  const order: any = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(orderId)
    .first();

  if (!order) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
  }

  const { results: items } = await c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?')
    .bind(orderId)
    .all();

  return c.json({
    success: true,
    data: {
      ...order,
      items: items || [],
    },
  });
});

// --- RBAC PROTECTED ROLE ENDPOINTS ---

// Merchant Only: Get Store Incoming Orders & Dashboard Stats
app.get('/api/merchant/dashboard', requireAuth, requireRole('merchant'), async (c) => {
  const user = c.get('user');
  const merchant: any = await c.env.DB.prepare('SELECT * FROM merchant_profiles WHERE user_id = ?')
    .bind(user.userId)
    .first();

  const merchantId = merchant ? merchant.id : 'merch_ayodhya';

  const { results: pendingOrders } = await c.env.DB.prepare(`
    SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 20
  `)
    .bind(merchantId)
    .all();

  return c.json({
    success: true,
    data: {
      merchant: merchant || { business_name: 'Ayodhya Hotel', id: merchantId },
      orders: pendingOrders || [],
    },
  });
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
