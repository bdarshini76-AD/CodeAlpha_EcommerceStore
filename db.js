const path = require('path');
// node:sqlite is built into Node.js (v22.5+), so no extra install is needed
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.join(__dirname, 'store.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Small helper: run a function inside a transaction (all changes saved together, or none)
db.transaction = (fn) => (...args) => {
  db.exec('BEGIN');
  try {
    const result = fn(...args);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};

// Create tables (users, products, orders, order_items)
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL,
  emoji TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  total REAL NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Placed',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price REAL NOT NULL
);
`);

// Add sample products the first time the app runs
const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
if (count === 0) {
  const insert = db.prepare(
    'INSERT INTO products (name, description, price, emoji, stock) VALUES (?, ?, ?, ?, ?)'
  );
  const samples = [
    ['Wireless Headphones', 'Over-ear Bluetooth headphones with 30 hours of battery life and deep bass.', 1999, '🎧', 50],
    ['Smart Watch', 'Fitness tracker with heart-rate monitor, step counter and sleep tracking.', 2999, '⌚', 30],
    ['Laptop Backpack', 'Water-resistant backpack with padded 15.6-inch laptop compartment.', 899, '🎒', 80],
    ['Mechanical Keyboard', 'RGB backlit keyboard with tactile blue switches.', 2499, '⌨️', 40],
    ['Gaming Mouse', 'Ergonomic mouse with adjustable DPI up to 12000.', 799, '🖱️', 60],
    ['Desk Lamp', 'LED desk lamp with 3 brightness levels and USB charging port.', 599, '💡', 70],
    ['Water Bottle', 'Insulated steel bottle that keeps drinks cold for 24 hours.', 449, '🍶', 120],
    ['Sunglasses', 'UV400 polarized sunglasses with a lightweight frame.', 699, '🕶️', 90],
  ];
  const insertMany = db.transaction((rows) => rows.forEach((r) => insert.run(...r)));
  insertMany(samples);
}

module.exports = db;