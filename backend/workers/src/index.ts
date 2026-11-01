import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { calculateDistanceKm } from './utils/distance';
import { isValidOrderTransition } from './utils/order-state';
import { OrderStatus } from '@ownlocal/types';

export interface Env {
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  ENVIRONMENT: string;
  PILOT_TOWN: string;
  PILOT_LATITUDE: number;
  PILOT_LONGITUDE: number;
  JWT_SECRET?: string;
}

const app = new Hono<{ Bindings: Env }>();

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
      timestamp: new Date().toISOString(),
    },
  });
});

// 2. Auth: Send OTP
app.post('/api/auth/send-otp', async (c) => {
  const body = await c.req.json<{ phone?: string; role?: string }>();
  if (!body.phone || !/^[6-9]\d{9}$/.test(body.phone)) {
    return c.json(
      { success: false, error: { code: 'INVALID_PHONE', message: 'Enter a valid 10-digit mobile number' } },
      400
    );
  }

  const role = body.role || 'customer';
  // Check or register user
  const existingUser = await c.env.DB.prepare('SELECT * FROM users WHERE phone = ?')
    .bind(body.phone)
    .first();

  if (!existingUser) {
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await c.env.DB.prepare(
      'INSERT INTO users (id, phone, role, status) VALUES (?, ?, ?, ?)'
    )
      .bind(userId, body.phone, role, 'active')
      .run();
  }

  // In development, return mock OTP 123456
  const mockOtp = '123456';
  return c.json({
    success: true,
    data: {
      message: `OTP sent to +91-${body.phone}`,
      mockOtp: c.env.ENVIRONMENT === 'production' ? undefined : mockOtp,
    },
  });
});

// 3. Auth: Verify OTP
app.post('/api/auth/verify-otp', async (c) => {
  const body = await c.req.json<{ phone?: string; otp?: string; role?: string }>();
  if (!body.phone || !body.otp) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Phone and OTP are required' } },
      400
    );
  }

  // Development check: allow 123456
  if (body.otp !== '123456') {
    return c.json(
      { success: false, error: { code: 'INVALID_OTP', message: 'Invalid OTP code entered' } },
      401
    );
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE phone = ?')
    .bind(body.phone)
    .first();

  if (!user) {
    return c.json(
      { success: false, error: { code: 'USER_NOT_FOUND', message: 'User record not found' } },
      404
    );
  }

  // Mock token for development (production will use JWT)
  const token = `ownlocal_${user.id}_${Date.now()}`;

  return c.json({
    success: true,
    data: {
      token,
      user,
    },
  });
});

// 4. Merchants: List & Nearby Discovery
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

  // Sort ascending by distance
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

// 5. Merchant Details
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

// 6. Products for Merchant
app.get('/api/merchants/:id/products', async (c) => {
  const merchantId = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM products WHERE merchant_id = ? AND active = 1 ORDER BY name ASC'
  )
    .bind(merchantId)
    .all();

  return c.json({ success: true, data: results || [] });
});

// 7. Orders: Create Order
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

  // Calculate pricing from DB
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

  // Insert Order
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

  // Insert Order Items
  for (const item of processedItems) {
    const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await c.env.DB.prepare(`
      INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(itemId, orderId, item.product_id, item.product_name, item.unit_price, item.quantity, item.total_price)
      .run();
  }

  // Insert Status History
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

// 8. Order Status & State Machine Updates
app.post('/api/orders/:id/status', async (c) => {
  const orderId = c.req.param('id');
  const body = await c.req.json<{ status: OrderStatus; notes?: string }>();

  const currentOrder: any = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?')
    .bind(orderId)
    .first();

  if (!currentOrder) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
  }

  // Validate state machine transition (Section 11)
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

// 9. Get Single Order
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

export default app;
