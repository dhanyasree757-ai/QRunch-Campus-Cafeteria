
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET =
  process.env.JWT_SECRET || 'DEV_ONLY_change_this_secret_before_deploying';

const db = new Database(path.join(__dirname, 'qrunch.sqlite'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// --------------------------------------------------
// DATABASE SCHEMA
// --------------------------------------------------

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','vendor')),
  student_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price >= 0),
  emoji TEXT NOT NULL DEFAULT '🍽️',
  badge TEXT NOT NULL DEFAULT 'POPULAR',
  available INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  student_user_id INTEGER REFERENCES users(id),
  student_name TEXT NOT NULL,
  student_id TEXT,
  status TEXT NOT NULL DEFAULT 'New'
    CHECK(status IN (
      'New','Preparing','Ready','Collected','Rejected','Cancelled'
    )),
  pickup_code TEXT NOT NULL UNIQUE,
  pickup_time TEXT NOT NULL,
  pickup_slot_key TEXT,
  total INTEGER NOT NULL CHECK(total >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  item_name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0)
);
`);

// Safely migrate an existing database.
const orderColumns = db.prepare('PRAGMA table_info(orders)').all();

if (!orderColumns.some(column => column.name === 'pickup_slot_key')) {
  db.exec('ALTER TABLE orders ADD COLUMN pickup_slot_key TEXT');
}

// --------------------------------------------------
// MENU DATA
// --------------------------------------------------

const menuSeed = [
  [1, 'Paneer Rice Bowl', 'Meals', 'Soft paneer, rice & a flavourful masala', 85, '🍛', 'STUDENT FAV'],
  [2, 'Veg Cheese Sandwich', 'Snacks', 'Toasted bread, veggies & melted cheese', 55, '🥪', 'BESTSELLER'],
  [3, 'Cold Coffee', 'Drinks', 'Chilled, creamy and just the right kick', 40, '🥤', 'CHILL PICK'],
  [4, 'Masala Dosa', 'Meals', 'Crispy dosa served with chutney', 60, '🥞', 'POPULAR'],
  [5, 'Fresh Fruit Bowl', 'Healthy', 'A refreshing mix of seasonal fruits', 50, '🥗', 'FRESH'],
  [6, 'Samosa Duo', 'Snacks', 'Two crispy, spicy potato samosas', 25, '🥟', 'QUICK BITE'],
  [7, 'Lemon Mint Cooler', 'Drinks', 'Fresh lemon with a minty twist', 30, '🍹', 'REFRESHING'],
  [8, 'Veg Fried Rice', 'Meals', 'Wok-tossed rice with crunchy vegetables', 75, '🍚', 'CHEF PICK'],
  [9, 'Veg Burger', 'Snacks', 'Fresh veggies, special sauce', 60, '🍔', 'POPULAR'],
  [10, 'Chicken Burger', 'Snacks', 'Juicy burger with signature sauce', 80, '🍔', 'BESTSELLER'],
  [11, 'French Fries', 'Snacks', 'Crispy and golden fries', 40, '🍟', 'QUICK BITE'],
  [12, 'Pizza', 'Meals', 'Loaded with veggies and cheese', 120, '🍕', 'POPULAR'],
  [13, 'Chocolate Pancakes', 'Desserts', 'Fluffy pancakes with chocolate drizzle', 70, '🥞', 'SWEET PICK'],
  [14, 'Mango Smoothie', 'Drinks', 'Cool mango smoothie', 45, '🥭', 'FRESH'],
  [15, 'Idli Sambar', 'Meals', 'Soft idlis with warm sambar', 45, '🍘', 'CLASSIC'],
  [16, 'Veg Wrap', 'Healthy', 'Crunchy vegetables in a soft wrap', 65, '🌯', 'FRESH']
];

const insertMenu = db.prepare(`
  INSERT OR IGNORE INTO menu_items
    (id, name, category, description, price, emoji, badge)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

menuSeed.forEach(item => insertMenu.run(...item));

// --------------------------------------------------
// DEMO ACCOUNTS
// --------------------------------------------------

function ensureDemoUser(name, email, password, role) {
  const existing = db.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).get(email);

  if (!existing) {
    db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run(name, email, bcrypt.hashSync(password, 10), role);
  }
}

ensureDemoUser(
  'QRunch Student',
  'student@qrunch.local',
  'Student123!',
  'student'
);

ensureDemoUser(
  'QRunch Vendor',
  'vendor@qrunch.local',
  'Vendor123!',
  'vendor'
);

// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

function auth(requiredRole) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ')
      ? header.slice(7)
      : '';

    if (!token) {
      return res.status(401).json({
        error: 'Sign in required.'
      });
    }

    try {
      req.user = jwt.verify(token, JWT_SECRET);

      if (requiredRole && req.user.role !== requiredRole) {
        return res.status(403).json({
          error: 'You do not have permission for this action.'
        });
      }

      next();
    } catch {
      return res.status(401).json({
        error: 'Session expired or invalid. Please sign in again.'
      });
    }
  };
}

function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

// --------------------------------------------------
// PICKUP SLOT CONFIGURATION
// --------------------------------------------------

const PICKUP_SLOT_CAPACITY = 10;
const PICKUP_SLOT_LENGTH_MS = 10 * 60 * 1000;

const countSlotOrders = db.prepare(`
  SELECT COUNT(*) AS count
  FROM orders
  WHERE pickup_slot_key = ?
    AND status IN ('New', 'Preparing', 'Ready')
`);

function getPickupSlots() {
  const now = Date.now();

  // First slot is the next 10-minute boundary.
  const firstSlot =
    (Math.floor(now / PICKUP_SLOT_LENGTH_MS) + 1) *
    PICKUP_SLOT_LENGTH_MS;

  return [10, 20, 30].map((minutes, index) => {
    const timestamp =
      firstSlot + index * PICKUP_SLOT_LENGTH_MS;

    const slotKey = new Date(timestamp).toISOString();
    const count = countSlotOrders.get(slotKey).count;

    return {
      slotKey,
      minutes,
      pickupTime: new Date(timestamp).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      }),
      remaining: Math.max(0, PICKUP_SLOT_CAPACITY - count),
      available: count < PICKUP_SLOT_CAPACITY
    };
  });
}

// --------------------------------------------------
// ORDER FORMATTER
// --------------------------------------------------


function formatOrder(id) {
  const order = db.prepare(
    'SELECT * FROM orders WHERE id = ?'
  ).get(id);

  if (!order) return null;

  const items = db.prepare(`
    SELECT
      menu_item_id AS id,
      item_name AS name,
      unit_price AS price,
      quantity AS qty
    FROM order_items
    WHERE order_id = ?
  `).all(id);

  return {
    id: order.public_id,
    student: order.student_name,
    studentId: order.student_id,
    code: order.pickup_code,
    items,
    total: order.total,
    status: order.status,
    pickupTime: order.pickup_time,
    pickupSlotKey: order.pickup_slot_key,
    createdAt: order.created_at
  };
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'QRunch API',
    database: 'SQLite'
  });
});

// --------------------------------------------------
// REGISTER
// --------------------------------------------------

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, studentId } = req.body || {};

  const role = req.body?.role === 'vendor'
    ? 'vendor'
    : 'student';

  if (
    !name ||
    !email ||
    !password ||
    String(name).trim().length > 60 ||
    String(password).length < 8
  ) {
    return res.status(400).json({
      error: 'Name, valid email, and a password of at least 8 characters are required.'
    });
  }

  try {
    const info = db.prepare(`
      INSERT INTO users
        (name, email, password_hash, role, student_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      String(name).trim(),
      String(email).trim().toLowerCase(),
      bcrypt.hashSync(String(password), 10),
      role,
      studentId ? String(studentId).slice(0, 30) : null
    );

    const user = db.prepare(`
      SELECT id, name, email, role, student_id
      FROM users
      WHERE id = ?
    `).get(info.lastInsertRowid);

    return res.status(201).json({
      token: makeToken(user),
      user
    });
  } catch (error) {
    if (String(error.code || '').includes('SQLITE_CONSTRAINT')) {
      return res.status(409).json({
        error: 'That email is already registered.'
      });
    }

    console.error('Registration error:', error);

    return res.status(500).json({
      error: 'Could not register. Please try again.'
    });
  }
});

// --------------------------------------------------
// LOGIN
// --------------------------------------------------

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};

  const user = db.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).get(String(email || '').trim().toLowerCase());

  if (
    !user ||
    !bcrypt.compareSync(String(password || ''), user.password_hash)
  ) {
    return res.status(401).json({
      error: 'Email or password is incorrect.'
    });
  }

  res.json({
    token: makeToken(user),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.student_id || null
    }
  });
});

app.get('/api/auth/me', auth(), (req, res) => {
  res.json({ user: req.user });
});

// --------------------------------------------------
// PICKUP SLOTS API
// --------------------------------------------------

app.get('/api/pickup-slots', auth('student'), (req, res) => {
  res.json({ slots: getPickupSlots() });
});

// --------------------------------------------------
// MENU API
// --------------------------------------------------

app.get('/api/menu', (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, category, description, price,
           emoji, badge, available
    FROM menu_items
    ORDER BY id
  `).all();

  res.json({
    items: rows.map(item => ({
      ...item,
      available: Boolean(item.available),
      rating: '4.8'
    }))
  });
});

app.patch('/api/menu/:id/availability', auth('vendor'), (req, res) => {
  const available = req.body?.available;

  if (typeof available !== 'boolean') {
    return res.status(400).json({
      error: 'available must be true or false.'
    });
  }

  const result = db.prepare(`
    UPDATE menu_items
    SET available = ?
    WHERE id = ?
  `).run(available ? 1 : 0, Number(req.params.id));

  if (!result.changes) {
    return res.status(404).json({
      error: 'Menu item not found.'
    });
  }

  res.json({ ok: true });
});

// --------------------------------------------------
// CREATE ORDER WITH PICKUP SLOT CAPACITY
// --------------------------------------------------

app.post('/api/orders', auth('student'), (req, res) => {
  const { items, slotKey } = req.body || {};

  if (
    !Array.isArray(items) ||
    items.length < 1 ||
    items.length > 30
  ) {
    return res.status(400).json({
      error: 'Add at least one menu item.'
    });
  }

  if (typeof slotKey !== 'string' || !slotKey) {
    return res.status(400).json({
      error: 'Please select a pickup slot.'
    });
  }

  // Combine duplicate menu item IDs.
  const aggregated = new Map();

  for (const item of items) {
    const id = Number(item?.id);
    const qty = Number(item?.qty);

    if (
      !Number.isInteger(id) ||
      !Number.isInteger(qty) ||
      id < 1 ||
      qty < 1 ||
      qty > 20
    ) {
      return res.status(400).json({
        error: 'Invalid item or quantity.'
      });
    }

    const newQty = (aggregated.get(id) || 0) + qty;

    if (newQty > 20) {
      return res.status(400).json({
        error: 'Maximum quantity per dish is 20.'
      });
    }

    aggregated.set(id, newQty);
  }

  // Verify every item and calculate the price on the server.
  const findItem = db.prepare(`
    SELECT id, name, price, available
    FROM menu_items
    WHERE id = ?
  `);

  const lines = [];
  let total = 0;

  for (const [id, qty] of aggregated) {
    const dish = findItem.get(id);

    if (!dish || !dish.available) {
      return res.status(400).json({
        error: 'One of the selected items is unavailable.'
      });
    }

    lines.push({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      qty
    });

    total += dish.price * qty;
  }

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      public_id,
      student_user_id,
      student_name,
      student_id,
      pickup_code,
      pickup_time,
      pickup_slot_key,
      total
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLine = db.prepare(`
    INSERT INTO order_items (
      order_id,
      menu_item_id,
      item_name,
      unit_price,
      quantity
    )
    VALUES (?, ?, ?, ?, ?)
  `);

  // better-sqlite3 immediate transactions prevent simultaneous
  // requests from exceeding the slot capacity.
  const createOrder = db.transaction(() => {
    // Confirm the selected slot is still one of the current slots.
    const slot = getPickupSlots().find(
      currentSlot => currentSlot.slotKey === slotKey
    );

    if (!slot) {
      const error = new Error(
        'This pickup slot has expired. Refresh and select another slot.'
      );
      error.statusCode = 409;
      throw error;
    }

    const currentCount = countSlotOrders.get(slotKey).count;

    if (currentCount >= PICKUP_SLOT_CAPACITY) {
      const error = new Error(
        'This pickup slot is full. Please select another slot.'
      );
      error.statusCode = 409;
      throw error;
    }

    const user = db.prepare(`
      SELECT student_id
      FROM users
      WHERE id = ?
    `).get(req.user.id);

    const publicId = `QR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const pickupCode = String(crypto.randomInt(1000, 10000));

    const result = insertOrder.run(
      publicId,
      req.user.id,
      req.user.name,
      user?.student_id || null,
      pickupCode,
      slot.pickupTime,
      slot.slotKey,
      total
    );

    const orderId = result.lastInsertRowid;

    for (const line of lines) {
      insertLine.run(
        orderId,
        line.id,
        line.name,
        line.price,
        line.qty
      );
    }

    return orderId;
  });

  try {
    const orderId = createOrder.immediate();

    return res.status(201).json({
      order: orderId)
    });
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({
        error: error.message
      });
    }

    console.error('Create order error:', error);

    return res.status(500).json({
      error: 'Could not place the order. Please try again.'
    });
  }
});

// --------------------------------------------------
// CANCEL ORDER
// --------------------------------------------------

app.post('/api/orders/:publicId/cancel', auth('student'), (req, res) => {
  const order = db.prepare(`
    SELECT *
    FROM orders
    WHERE public_id = ?
      AND student_user_id = ?
  `).get(req.params.publicId, req.user.id);

  if (!order) {
    return res.status(404).json({
      error: 'Order not found.'
    });
  }

  if (order.status !== 'New') {
    return res.status(409).json({
      error: 'Only new orders can be cancelled. The kitchen may already be preparing it.'
    });
  }

  const ageSeconds = db.prepare(`
    SELECT (julianday('now') - julianday(?)) * 86400 AS age
  `).get(order.created_at).age;

  if (ageSeconds > 600) {
    return res.status(409).json({
      error: 'The 10-minute cancellation window has expired.'
    });
  }

  const result = db.prepare(`
    UPDATE orders
    SET status = 'Cancelled'
    WHERE id = ? AND status = 'New'
  `).run(order.id);

  if (!result.changes) {
    return res.status(409).json({
      error: 'The order status has changed. Refresh and try again.'
    });
  }

  res.json({
    order: formatOrder(order.id),
    message: 'Order cancelled within the 10-minute window.'
  });
});

// --------------------------------------------------
// STUDENT ORDERS
// --------------------------------------------------

app.get('/api/orders/mine', auth('student'), (req, res) => {
  const rows = db.prepare(`
    SELECT id
    FROM orders
    WHERE student_user_id = ?
    ORDER BY id DESC
  `).all(req.user.id);

  res.json({
    orders: rows.map(order => formatOrder(order.id))
  });
});

// --------------------------------------------------
// VENDOR: VIEW ALL ORDERS
// --------------------------------------------------

app.get('/api/orders', auth('vendor'), (req, res) => {
  const rows = db.prepare(`
    SELECT id
    FROM orders
    ORDER BY id DESC
  `).all();

  res.json({
    orders: rows.map(order => formatOrder(order.id))
  });
});

// --------------------------------------------------
// VENDOR: UPDATE ORDER STATUS
// --------------------------------------------------

app.patch('/api/orders/:publicId/status', auth('vendor'), (req, res) => {
  const next = String(req.body?.status || '');

  const allowed = {
    New: ['Preparing', 'Rejected'],
    Preparing: ['Ready'],
    Ready: ['Collected']
  };

  const order = db.prepare(`
    SELECT *
    FROM orders
    WHERE public_id = ?
  `).get(req.params.publicId);

  if (!order) {
    return res.status(404).json({
      error: 'Order not found.'
    });
  }

  if (!(allowed[order.status] || []).includes(next)) {
    return res.status(400).json({
      error: `Cannot change status from ${order.status} to ${next}.`
    });
  }

  if (
    next === 'Collected' &&
    String(req.body?.pickupCode || '').trim() !== order.pickup_code
  ) {
    return res.status(400).json({
      error: 'Pickup code does not match. Order was not collected.'
    });
  }

  const result = db.prepare(`
    UPDATE orders
    SET status = ?
    WHERE id = ? AND status = ?
  `).run(next, order.id, order.status);

  if (!result.changes) {
    return res.status(409).json({
      error: 'Order status changed. Refresh and try again.'
    });
  }

  res.json({
    order: formatOrder(order.id)
  });
});

// --------------------------------------------------
// VENDOR: VERIFY PICKUP CODE
// --------------------------------------------------

app.post('/api/pickup/verify', auth('vendor'), (req, res) => {
  const code = String(req.body?.code || '').trim();

  const order = db.prepare(`
    SELECT id, status
    FROM orders
    WHERE pickup_code = ?
  `).get(code);

  if (!order) {
    return res.status(404).json({
      error: 'Pickup code not found.'
    });
  }

  if (order.status !== 'Ready') {
    return res.status(409).json({
      error: `Order is ${order.status}. Only ready orders can be collected.`
    });
  }

  const result = db.prepare(`
    UPDATE orders
    SET status = 'Collected'
    WHERE id = ? AND status = 'Ready'
  `).run(order.id);

  if (!result.changes) {
    return res.status(409).json({
      error: 'Order status changed. Please refresh and try again.'
    });
  }

  res.json({
    order: formatOrder(order.id),
    message: 'Pickup verified. Order marked collected.'
  });
});

// --------------------------------------------------
// STATIC FILES AND PAGE ROUTES
// --------------------------------------------------

app.use(express.static(path.join(__dirname, 'public')));

app.get('/common.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/common.js'));
});

app.get('/student', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/student/student.html'));
});

app.use('/student', express.static(path.join(__dirname, 'public/student')));

app.get('/vendor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/vendor/vendor.html'));
});

app.use('/vendor', express.static(path.join(__dirname, 'public/vendor')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/auth.html'));
});

app.get('/auth.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth.html'));
});

// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Unexpected server error.'
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`QRunch server running at http://localhost:${PORT}`);
});
