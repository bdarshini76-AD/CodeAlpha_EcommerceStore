# CodeAlpha_EcommerceStore

Simple E-commerce Store built for the **CodeAlpha Full Stack Development Internship (Task 1)**.

## Features
- Product listing page
- Product details page
- Shopping cart (add, remove, change quantity)
- User registration and login (passwords hashed with bcrypt, sessions with JWT)
- Order processing (checkout, stock reduced, order history)
- Database storing users, products, orders and order items (SQLite)

## Tech stack
- **Frontend:** HTML, CSS, JavaScript (no framework)
- **Backend:** Node.js + Express.js
- **Database:** SQLite (via `better-sqlite3`)
- **Auth:** JWT + bcryptjs

## How to run
1. Install [Node.js](https://nodejs.org) (version 18 or newer)
2. Open a terminal in this folder and run:
   ```bash
   npm install
   npm start
   ```
3. Open http://localhost:3000 in your browser

The database file (`store.db`) and 8 sample products are created automatically on first run.

## Project structure
```
CodeAlpha_EcommerceStore/
├── server.js        # Express server + REST API
├── db.js            # SQLite connection, tables, sample products
├── package.json
└── public/          # Frontend
    ├── index.html
    ├── style.css
    └── app.js       # Pages, cart, login, checkout
```

## API endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/register` | No | Create account |
| POST | `/api/login` | No | Login, returns JWT |
| GET | `/api/products` | No | List all products |
| GET | `/api/products/:id` | No | Single product |
| POST | `/api/orders` | Yes | Place an order |
| GET | `/api/orders` | Yes | Logged-in user's orders |

## Database tables
- `users` (id, name, email, password hash)
- `products` (id, name, description, price, emoji, stock)
- `orders` (id, user_id, total, address, status, created_at)
- `order_items` (id, order_id, product_id, quantity, price)
