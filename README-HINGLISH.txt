AALIYA COLLECTION — WEBSITE PACKAGE

Is package mein storefront, product catalog API, cart, COD checkout, order tracking,
return request, admin panel, product management, order status aur admin password reset included hain.

IMPORTANT — production ke liye:
1) Render par Node 18+ Web Service; Build Command: npm install; Start Command: npm start.
2) Environment variables:
   SESSION_SECRET = long random secret
   ADMIN_SETUP_KEY = separate one-time setup key
   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM = email OTP
   DB_PATH = persistent disk path e.g. /var/data/aaliya.sqlite
3) Render persistent disk mount /var/data set karo; DB_PATH=/var/data/aaliya.sqlite.
   SQLite files ephemeral disk par data lose kar sakti hain.
4) Admin initial setup POST /api/admin/setup with setupKey,email,password.
   Password minimum 12 chars. Existing admin ho to setup blocked; forgot password SMTP OTP se.
5) Admin: /admin
6) Customer payment currently COD ONLY. UPI option deliberately disabled in backend until
   Razorpay account integration + key secrets + signature verification complete.
   Never mark online payment paid without server verification.
7) Product images: secure HTTPS image URL admin panel mein.
8) Returns request: homepage Returns section; matching order ID and phone required.
9) Before public launch: test product/order/return/admin on staging, privacy policy,
   terms, shipping/returns policy, GST/business details, backup and monitoring.
10) Admin setup key/password/SMTP secrets chat/GitHub mein share mat karna; Render Environment mein set.
This is a starter implementation, not audited/hack-proof production software.
