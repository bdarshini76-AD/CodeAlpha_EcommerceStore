// ===================== Helpers =====================
const app = document.getElementById('app');
const nav = document.getElementById('nav');

const money = (n) => '₹' + Number(n).toLocaleString('en-IN');

// Escape text before putting it in HTML (prevents XSS)
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch('/api' + path, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// ===================== Auth state =====================
const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
};
function saveAuth(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
}
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.hash = '#/';
  renderNav();
}

// ===================== Cart (kept in localStorage) =====================
const getCart = () => {
  try { return JSON.parse(localStorage.getItem('cart')) || []; } catch { return []; }
};
const saveCart = (cart) => {
  localStorage.setItem('cart', JSON.stringify(cart));
  renderNav();
};
function addToCart(product, qty = 1) {
  const cart = getCart();
  const found = cart.find((i) => i.id === product.id);
  if (found) found.quantity = Math.min(found.quantity + qty, product.stock);
  else cart.push({ id: product.id, name: product.name, price: product.price, emoji: product.emoji, stock: product.stock, quantity: Math.min(qty, product.stock) });
  saveCart(cart);
  toast(product.name + ' added to cart');
}
const cartCount = () => getCart().reduce((n, i) => n + i.quantity, 0);
const cartTotal = () => getCart().reduce((n, i) => n + i.price * i.quantity, 0);

// ===================== Navbar =====================
function renderNav() {
  const user = getUser();
  nav.innerHTML = `
    <a href="#/">Products</a>
    <a href="#/cart">Cart<span class="badge">${cartCount()}</span></a>
    ${
      user
        ? `<a href="#/orders">My Orders</a><span class="muted">Hi, ${esc(user.name)}</span><button class="link" id="logout">Logout</button>`
        : `<a href="#/login">Login</a><a href="#/register">Register</a>`
    }`;
  const btn = document.getElementById('logout');
  if (btn) btn.onclick = logout;
}

// ===================== Views =====================
async function productsView() {
  app.innerHTML = '<h1>All Products</h1><p class="muted">Loading...</p>';
  const products = await api('/products');
  app.innerHTML = `
    <h1>All Products</h1>
    <div class="grid">
      ${products
        .map(
          (p) => `
        <div class="card product-card">
          <a href="#/product/${p.id}"><div class="emoji">${esc(p.emoji)}</div></a>
          <h3><a href="#/product/${p.id}">${esc(p.name)}</a></h3>
          <div class="price">${money(p.price)}</div>
          <div class="muted">${p.stock > 0 ? p.stock + ' in stock' : 'Out of stock'}</div>
          <button class="btn add" data-id="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>Add to Cart</button>
        </div>`
        )
        .join('')}
    </div>`;
  app.querySelectorAll('.add').forEach((btn) => {
    btn.onclick = () => addToCart(products.find((p) => p.id == btn.dataset.id));
  });
}

async function productDetailView(id) {
  const p = await api('/products/' + id);
  app.innerHTML = `
    <p><a href="#/" class="muted">← Back to products</a></p>
    <div class="product-detail" style="margin-top:16px">
      <div class="big-emoji">${esc(p.emoji)}</div>
      <div class="info">
        <h1>${esc(p.name)}</h1>
        <div class="price">${money(p.price)}</div>
        <p>${esc(p.description)}</p>
        <p class="muted">${p.stock > 0 ? p.stock + ' in stock' : 'Out of stock'}</p>
        <div class="qty">
          <button id="minus">−</button>
          <input id="qty" type="number" min="1" max="${p.stock}" value="1" />
          <button id="plus">+</button>
        </div>
        <div><button class="btn" id="add" ${p.stock < 1 ? 'disabled' : ''}>Add to Cart</button></div>
      </div>
    </div>`;
  const input = document.getElementById('qty');
  document.getElementById('minus').onclick = () => (input.value = Math.max(1, input.value - 1));
  document.getElementById('plus').onclick = () => (input.value = Math.min(p.stock, +input.value + 1));
  document.getElementById('add').onclick = () => addToCart(p, Math.max(1, parseInt(input.value, 10) || 1));
}

function cartView() {
  const cart = getCart();
  if (cart.length === 0) {
    app.innerHTML = '<h1>Your Cart</h1><div class="empty"><p>Your cart is empty.</p><br /><a class="btn" href="#/">Continue shopping</a></div>';
    return;
  }
  app.innerHTML = `
    <h1>Your Cart</h1>
    <table>
      <thead><tr><th>Product</th><th>Price</th><th>Quantity</th><th>Subtotal</th><th></th></tr></thead>
      <tbody>
        ${cart
          .map(
            (i) => `
          <tr>
            <td>${esc(i.emoji)} <a href="#/product/${i.id}">${esc(i.name)}</a></td>
            <td>${money(i.price)}</td>
            <td>
              <span class="qty">
                <button data-act="dec" data-id="${i.id}">−</button>
                <strong>${i.quantity}</strong>
                <button data-act="inc" data-id="${i.id}">+</button>
              </span>
            </td>
            <td>${money(i.price * i.quantity)}</td>
            <td><button class="btn danger" data-act="rm" data-id="${i.id}">Remove</button></td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    <div class="summary">
      <span class="total">Total: ${money(cartTotal())}</span>
      <a class="btn" href="#/checkout">Proceed to Checkout</a>
    </div>`;
  app.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.onclick = () => {
      const c = getCart();
      const item = c.find((i) => i.id == btn.dataset.id);
      if (btn.dataset.act === 'inc') item.quantity = Math.min(item.quantity + 1, item.stock);
      if (btn.dataset.act === 'dec') item.quantity = Math.max(1, item.quantity - 1);
      if (btn.dataset.act === 'rm') c.splice(c.indexOf(item), 1);
      saveCart(c);
      cartView();
    };
  });
}

function checkoutView() {
  if (!getUser()) {
    toast('Please log in to checkout');
    location.hash = '#/login';
    return;
  }
  const cart = getCart();
  if (cart.length === 0) { location.hash = '#/cart'; return; }
  app.innerHTML = `
    <h1>Checkout</h1>
    <form class="form-card" id="checkout">
      <div id="msg"></div>
      <p>${cart.length} item(s) · <strong>Total: ${money(cartTotal())}</strong></p>
      <label>Delivery address
        <textarea id="address" rows="3" required placeholder="House no, street, city, PIN"></textarea>
      </label>
      <button class="btn" type="submit">Place Order</button>
    </form>`;
  document.getElementById('checkout').onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    try {
      const result = await api('/orders', {
        method: 'POST',
        body: {
          address: document.getElementById('address').value,
          items: getCart().map((i) => ({ productId: i.id, quantity: i.quantity })),
        },
      });
      saveCart([]);
      app.innerHTML = `
        <div class="empty">
          <h1>🎉 Order placed!</h1>
          <p>Your order number is <strong>#${result.orderId}</strong>. Total paid: ${money(result.total)}</p><br />
          <a class="btn" href="#/orders">View my orders</a>
        </div>`;
    } catch (err) {
      msg.innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
    }
  };
}

async function ordersView() {
  if (!getUser()) { location.hash = '#/login'; return; }
  app.innerHTML = '<h1>My Orders</h1><p class="muted">Loading...</p>';
  const orders = await api('/orders');
  if (orders.length === 0) {
    app.innerHTML = '<h1>My Orders</h1><div class="empty"><p>You have not placed any orders yet.</p></div>';
    return;
  }
  app.innerHTML = `
    <h1>My Orders</h1>
    ${orders
      .map(
        (o) => `
      <div class="card order-card">
        <div class="order-head">
          <strong>Order #${o.id}</strong>
          <span class="status">${esc(o.status)}</span>
        </div>
        <div class="muted">${esc(o.created_at)} (UTC) · Deliver to: ${esc(o.address)}</div>
        <ul style="margin-left:18px">
          ${o.items.map((i) => `<li>${esc(i.emoji)} ${esc(i.name)} × ${i.quantity} — ${money(i.price * i.quantity)}</li>`).join('')}
        </ul>
        <strong>Total: ${money(o.total)}</strong>
      </div>`
      )
      .join('')}`;
}

function authView(mode) {
  const isLogin = mode === 'login';
  app.innerHTML = `
    <form class="form-card" id="auth">
      <h2>${isLogin ? 'Login' : 'Create account'}</h2>
      <div id="msg"></div>
      ${isLogin ? '' : '<label>Name<input id="name" required /></label>'}
      <label>Email<input id="email" type="email" required /></label>
      <label>Password<input id="password" type="password" minlength="6" required /></label>
      <button class="btn" type="submit">${isLogin ? 'Login' : 'Register'}</button>
      <p class="muted">${
        isLogin
          ? 'New here? <a href="#/register"><u>Create an account</u></a>'
          : 'Already registered? <a href="#/login"><u>Login</u></a>'
      }</p>
    </form>`;
  document.getElementById('auth').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
      };
      if (!isLogin) body.name = document.getElementById('name').value;
      const data = await api(isLogin ? '/login' : '/register', { method: 'POST', body });
      saveAuth(data);
      renderNav();
      location.hash = getCart().length ? '#/cart' : '#/';
    } catch (err) {
      document.getElementById('msg').innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
    }
  };
}

// ===================== Router =====================
async function router() {
  const hash = location.hash || '#/';
  renderNav();
  try {
    if (hash === '#/') await productsView();
    else if (hash.startsWith('#/product/')) await productDetailView(hash.split('/')[2]);
    else if (hash === '#/cart') cartView();
    else if (hash === '#/checkout') checkoutView();
    else if (hash === '#/orders') await ordersView();
    else if (hash === '#/login') authView('login');
    else if (hash === '#/register') authView('register');
    else app.innerHTML = '<div class="empty"><h1>Page not found</h1></div>';
  } catch (err) {
    // If the token expired, send the user back to login
    if (/log in/i.test(err.message)) { logout(); location.hash = '#/login'; }
    else app.innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
  }
}

window.addEventListener('hashchange', router);
router();
