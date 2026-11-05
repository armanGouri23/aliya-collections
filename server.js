
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// DATABASE
const db = new Database(process.env.DB_PATH || "store.db");

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  price REAL NOT NULL,
  image TEXT DEFAULT '',
  description TEXT DEFAULT '',
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  items TEXT NOT NULL,
  total REAL NOT NULL,
  status TEXT DEFAULT 'New',
  payment TEXT DEFAULT 'Pending',
  created TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);
`);

// SECURITY
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-secret-before-live",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 1000
  }
}));

app.use("/api/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10
}));

// WEBSITE
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ADMIN CHECK
function admin(req, res, next) {
  if (req.session.admin === true) {
    return next();
  }
  return res.status(401).json({ error: "Login required" });
}

// PRODUCTS
app.get("/api/products", (req, res) => {
  const products = db.prepare(
    "SELECT * FROM products WHERE active = 1 ORDER BY id DESC"
  ).all();

  res.json(products);
});

// CREATE ORDER
app.post("/api/orders", (req, res) => {
  const { customer, phone, address, items } = req.body;

  if (!customer || !phone || !address ||
      !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "Please fill all order details"
    });
  }

  let total = 0;

  for (const item of items) {
    const product = db.prepare(
      "SELECT price FROM products WHERE id = ? AND active = 1"
    ).get(Number(item.id));

    if (!product) {
      return res.status(400).json({
        error: "Invalid product"
      });
    }

    const qty = Math.max(1, Math.min(100, Number(item.qty) || 1));
    total += product.price * qty;
  }

  const result = db.prepare(`
    INSERT INTO orders(customer, phone, address, items, total)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    customer,
    phone,
    address,
    JSON.stringify(items),
    total
  );

  res.json({
    success: true,
    orderId: result.lastInsertRowid,
    total
  });
});

// CREATE ADMIN
app.post("/api/setup-admin", (req, res) => {
  if (!process.env.ADMIN_SETUP_KEY ||
      req.body.key !== process.env.ADMIN_SETUP_KEY) {
    return res.status(403).json({
      error: "Invalid setup key"
    });
  }

  const { username, password } = req.body;

  if (!username || !password || password.length < 10) {
    return res.status(400).json({
      error: "Password must be at least 10 characters"
    });
  }

  const existing = db.prepare(
    "SELECT id FROM admins LIMIT 1"
  ).get();

  if (existing) {
    return res.status(403).json({
      error: "Admin already exists"
    });
  }

  const hashed = bcrypt.hashSync(password, 12);

  db.prepare(
    "INSERT INTO admins(username, password) VALUES (?, ?)"
  ).run(username, hashed);

  res.json({ success: true });
});

// ADMIN LOGIN
app.post("/api/login", (req, res) => {
  const user = db.prepare(
    "SELECT * FROM admins WHERE username = ?"
  ).get(req.body.username);

  if (!user ||
      !bcrypt.compareSync(req.body.password || "", user.password)) {
    return res.status(401).json({
      error: "Wrong username or password"
    });
  }

  req.session.admin = true;
  res.json({ success: true });
});

// ADMIN LOGOUT
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// ADMIN ORDERS
app.get("/api/admin/orders", admin, (req, res) => {
  const orders = db.prepare(
    "SELECT * FROM orders ORDER BY id DESC"
  ).all();

  res.json(orders);
});

// UPDATE ORDER
app.patch("/api/admin/orders/:id", admin, (req, res) => {
  const { status, payment } = req.body;

  db.prepare(`
    UPDATE orders
    SET status = ?, payment = ?
    WHERE id = ?
  `).run(
    status || "New",
    payment || "Pending",
    Number(req.params.id)
  );

  res.json({ success: true });
});

// ADD PRODUCT
app.post("/api/admin/products", admin, (req, res) => {
  const { name, category, price, image, description } = req.body;

  if (!name || !Number.isFinite(Number(price)) ||
      Number(price) <= 0) {
    return res.status(400).json({
      error: "Valid product name and price required"
    });
  }

  const result = db.prepare(`
    INSERT INTO products(name, category, price, image, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    name,
    category || "",
    Number(price),
    image || "",
    description || ""
  );

  res.json({
    success: true,
    productId: result.lastInsertRowid
  });
});

// DELETE PRODUCT
app.delete("/api/admin/products/:id", admin, (req, res) => {
  db.prepare(
    "UPDATE products SET active = 0 WHERE id = ?"
  ).run(Number(req.params.id));

  res.json({ success: true });
});

// SERVER
app.listen(PORT, "0.0.0.0", () => {
  console.log("Aaliya Collections website running on port " + PORT);
});
    
