
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// RENDER CONFIG
app.set("trust proxy", 1);

// DATABASE
const db = new Database(process.env.DB_PATH || "store.db");

db.pragma("journal_mode = WAL");

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
  name: "aaliya.sid",
  secret: process.env.SESSION_SECRET || "change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 1000
  }
}));

// LOGIN RATE LIMIT
app.use("/api/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "Too many login attempts. Please wait 15 minutes."
    });
  }
}));

// WEBSITE
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/health", (req, res) => {
  res.json({ success: true, status: "online" });
});

// ADMIN CHECK
function admin(req, res, next) {
  if (req.session.admin === true) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: "Login required"
  });
}

// PRODUCTS
app.get("/api/products", (req, res) => {
  try {
    const products = db.prepare(
      "SELECT * FROM products WHERE active = 1 ORDER BY id DESC"
    ).all();

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Products load failed" });
  }
});

// CREATE ORDER
app.post("/api/orders", (req, res) => {
  try {
    const { customer, phone, address, items } = req.body;

    if (!customer || !phone || !address ||
        !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
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
          success: false,
          error: "Invalid product"
        });
      }

      const qty = Math.max(
        1,
        Math.min(100, Number(item.qty) || 1)
      );

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
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Order could not be placed"
    });
  }
});

// CREATE ADMIN
app.post("/api/setup-admin", (req, res) => {
  try {
    if (!process.env.ADMIN_SETUP_KEY ||
        req.body.key !== process.env.ADMIN_SETUP_KEY) {
      return res.status(403).json({
        success: false,
        error: "Invalid setup key"
      });
    }

    const { username, password } = req.body;

    if (!username || !password || password.length < 10) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 10 characters"
      });
    }

    const existing = db.prepare(
      "SELECT id FROM admins LIMIT 1"
    ).get();

    if (existing) {
      return res.status(403).json({
        success: false,
        error: "Admin already exists"
      });
    }

    const hashed = bcrypt.hashSync(password, 12);

    db.prepare(
      "INSERT INTO admins(username, password) VALUES (?, ?)"
    ).run(username, hashed);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Admin creation failed"
    });
  }
});

// ADMIN LOGIN
app.post("/api/login", (req, res) => {
  try {
    const username = req.body.username;
    const password = req.body.password || "";

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Username and password required"
      });
    }

    const user = db.prepare(
      "SELECT * FROM admins WHERE username = ?"
    ).get(username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({
        success: false,
        error: "Wrong username or password"
      });
    }

    req.session.regenerate((err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          error: "Session error"
        });
      }

      req.session.admin = true;
      req.session.username = user.username;

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error(saveErr);
          return res.status(500).json({
            success: false,
            error: "Login session could not be saved"
          });
        }

        res.json({ success: true });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Login failed"
    });
  }
});

// ADMIN LOGOUT
app.post("/api/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        success: false,
        error: "Logout failed"
      });
    }

    res.clearCookie("aaliya.sid");
    res.json({ success: true });
  });
});

// ADMIN ORDERS
app.get("/api/admin/orders", admin, (req, res) => {
  try {
    const orders = db.prepare(
      "SELECT * FROM orders ORDER BY id DESC"
    ).all();

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Orders load failed" });
  }
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
      success: false,
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
  console.log("Aaliya Collection running on port " + PORT);
});
      
