# Aliya Collections store starter
This is a starter project, not yet production-ready or deployed.

## Local run (Node.js 20+)
1. Copy `.env.example` to `.env` and set strong secrets.
2. `npm install`
3. `npm start`
4. Visit `/` and `/admin.html`.
5. Create the admin once with POST `/api/setup-admin` using JSON `{ "key":"YOUR_ADMIN_SETUP_KEY", "username":"admin", "password":"a-long-password" }`.

## Before public launch
This scaffold requires a security review and hardening: persistent session store, CSRF protection, secure secrets, database backups/persistent storage, validation, shipping/privacy/legal pages, and payment integration. Do not use it for real customer data until secured. Account ownership, hosting, and payments should be managed by the business proprietor/authorized adult.
