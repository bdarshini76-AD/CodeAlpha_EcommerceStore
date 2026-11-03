const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
// Change this secret (or set the JWT_SECRET environment variable) before deploying
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Auth middleware ----------
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please log in first' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

function makeToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

// ---------- User registration / login ----------
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (exists) return res.status(409).json({ error: 'Email is already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)')
    .run(String(name).trim(), cleanEmail, hash);
  const user = { id: info.lastInsertRowid, name: String(name).trim(), email: cleanEmail };
  res.status(201).json({ token: makeToken(user), user });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email).trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const safe = { id: user.id, name: user.name, email: user.email };
  res.json({ token: makeToken(safe), user: safe });
});

// ---------- Products ----------
app.get('/api/products', (req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY id').all());
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// ---------- Orders (order processing) ----------
// Body: { items: [{ productId, quantity }], address }
app.post('/api/orders', auth, (req, res) => {
  const { items, address } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty' });
  }
  if (!address || !String(address).trim()) {
    return res.status(400).json({ error: 'Delivery address is required' });
  }

  const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
  const reduceStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
  const insertOrder = db.prepare('INSERT INTO orders (user_id, total, address) VALUES (?, ?, ?)');
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)'
  );

  // A transaction makes sure everything is saved together, or nothing is
  const placeOrder = db.transaction(() => {
    let total = 0;
    const lines = [];
    for (const item of items) {
      const qty = parseInt(item.quantity, 10);
      const product = getProduct.get(item.productId);
      if (!product) throw new Error('A product in your cart no longer exists');
      if (!qty || qty < 1) throw new Error('Invalid quantity for ' + product.name);
      if (product.stock < qty) throw new Error('Not enough stock for ' + product.name);
      // Price always comes from the database, never from the browser
      total += product.price * qty;
      lines.push({ product, qty });
    }
    const order = insertOrder.run(req.user.id, total, String(address).trim());
    for (const { product, qty } of lines) {
      insertItem.run(order.lastInsertRowid, product.id, qty, product.price);
      reduceStock.run(qty, product.id);
    }
    return { orderId: order.lastInsertRowid, total };
  });

  try {
    res.status(201).json(placeOrder());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/orders', auth, (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC')
    .all(req.user.id);
  const itemsStmt = db.prepare(`
    SELECT oi.quantity, oi.price, p.name, p.emoji
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?`);
  res.json(orders.map((o) => ({ ...o, items: itemsStmt.all(o.id) })));
});

app.listen(PORT, () => {
  console.log(`Store running at http://localhost:${PORT}`);
});
