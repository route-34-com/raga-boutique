# Raga Boutique

E-commerce store + admin panel.

```
backend/    FastAPI · SQLAlchemy · Alembic · Postgres 16 · pytest
frontend/   React · TypeScript · Vite · Tailwind · shadcn/ui · TanStack Query · Zustand
deploy/     Droplet setup: low-RAM Postgres config, systemd service, Caddyfile
```

## Run locally

Needs Postgres 16 running (`brew services start postgresql@16`) with a `raga` user and database
(see "First-time setup" below), plus `uv` and Node.

```bash
# terminal 1 — API on :8000 (docs at http://127.0.0.1:8000/api/docs)
cd backend && uv run uvicorn app.main:app --reload --reload-dir app

# terminal 2 — site on :5173 (proxies /api and /uploads to the API)
cd frontend && npm run dev
```

- Store: http://localhost:5173
- Admin: http://localhost:5173/admin (log in with **9000000001**)
- Test customers with order history: **9000000002** to **9000000006**. Any other number signs up as a new customer.

In demo mode (`OTP_PROVIDER=console`) no SMS is sent: the code appears on screen and in the API log.

Reset the demo before showing it (wipes orders and photos, then reloads the catalog):
```bash
cd backend && uv run python -m scripts.seed --demo --reset
```

### First-time setup
```bash
psql -d postgres -c "CREATE ROLE raga LOGIN PASSWORD 'raga_dev'" -c "CREATE DATABASE raga OWNER raga" -c "CREATE DATABASE raga_test OWNER raga"
cd backend && cp .env.example .env && uv sync && uv run alembic upgrade head && uv run python -m scripts.seed --demo
cd ../frontend && npm install
```

## Tests
```bash
cd backend && uv run pytest        # uses the raga_test database (override with TEST_DATABASE_URL)
```
Covers OTP login and lockout, server-side prices, no overselling (row locks), duplicate cart lines,
cancellation restocking, the order status flow, admin-only access, search, plain-language validation
errors and contact settings.

## Deploying (Vercel)

Live at https://raga-boutique.vercel.app. Every push to `main` deploys to production; other branches
get a preview URL. `vercel.json` builds the frontend and serves the API as one Python function
(`api/index.py`); the catalog photos are copied into the build so the CDN serves them directly.

The database is Neon Postgres (Vercel Marketplace, Singapore), which sets `DATABASE_URL`. The project
also needs: `ENV=demo`, `OTP_PROVIDER=console` (or `msg91`), `JWT_SECRET`, `COOKIE_SECURE=true`,
`IMAGE_STORE=db` (Vercel has no lasting disk, so uploaded photos are kept in Postgres) and
`SERVERLESS=true`. Preview deployments share the production database.

Migrations don't run on deploy. After adding one, run it against Neon (use the unpooled URL):
```bash
vercel env pull .env.production.local --environment production
cd backend && DATABASE_URL="<DATABASE_URL_UNPOOLED>" IMAGE_STORE=db uv run alembic upgrade head
```
If backend dependencies change, regenerate `requirements.txt` (command at the top of that file).

## How it's organised

**Backend** (`backend/app/`)
| Folder | What's in it |
|---|---|
| `core/` | settings (`.env`), database session, session cookie (JWT), auth dependencies |
| `models/` | tables: users, addresses, OTP codes, categories, products, variants (size + stock), images, orders, order items, order events, store settings |
| `schemas/` | request/response shapes |
| `services/` | business rules: `orders.py` (place / cancel / status), `auth.py` (OTP), `otp/` (SMS senders), `images.py` |
| `routers/` | `auth`, `catalog` (public), `account` (customer), `admin/*` |

**Frontend** (`frontend/src/`)
| Folder | What's in it |
|---|---|
| `components/ui/` | shadcn components |
| `components/common/` | shared: OTP login form, status badge, order timeline |
| `components/store/`, `pages/store/` | storefront |
| `components/admin/`, `pages/admin/` | admin panel (lazy-loaded; shoppers never download it) |
| `hooks/queries.ts`, `lib/api.ts` | data fetching |
| `stores/` | bag + wishlist (saved in the browser), login dialog |

## Rules worth knowing
- Prices and stock are always read from the database at checkout; the browser only sends product, size and quantity.
- Stock rows are locked while an order is placed, so two people can't buy the last piece.
- Order flow: placed → confirmed (owner presses Accept) → packed → shipped (courier + tracking required) → delivered.
  Admins can skip ahead, never go back. Only admins can cancel; it puts stock back. No returns. COD orders are marked paid on delivery.
- The bag lives in the browser tab only (sessionStorage); closing the tab asks first. Login happens at checkout; email is required.
- Messages: new order → shop email (+ WhatsApp in cloud mode); Accept → customer WhatsApp + email; shipped (Admin → Dispatch,
  one tracking ID per order) → customer WhatsApp + email with the tracking link. Each message goes out once per order and shows on the order.
- Orders keep their own copy of the address, product name, price and photo, so editing or deleting a product never changes old orders.
- OTP: 6 digits, valid 5 minutes, 5 wrong tries max, 30 s between resends, 5 per hour per number.

## Switching on real SMS
Set in `backend/.env`: `OTP_PROVIDER=msg91`, `MSG91_AUTHKEY`, `MSG91_TEMPLATE_ID` (a DLT-approved template with an `##otp##` variable).
Another provider = one new file in `app/services/otp/` + one line in its `__init__.py`.

## Switching on WhatsApp and email
Until set up, WhatsApp runs in **tap** mode (admin gets "Open WhatsApp" with the message typed; owner taps send) and email in
**console** mode (logged only).

- Email: `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`.
  Brevo free plan: host `smtp-relay.brevo.com`, 300 emails/day. Also set the shop email under Admin → Settings for new-order alerts.
- WhatsApp Cloud API (Meta): `WHATSAPP_MODE=cloud`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN` (permanent system-user token),
  `WHATSAPP_LANG` (`en`). Create three **Utility** templates with these names and body variables, in this order:
  - `accepted`: `Hi {{1}}, your Raga order {{2}} is confirmed. We'll message you the tracking details once it ships. Total {{3}} (cash on delivery).`
  - `shipped`: `Hi {{1}}, your Raga order {{2}} is on its way with {{3}}. Tracking ID: {{4}}. Track it here: {{5}}`
  - `new_order`: `New order {{1}}: {{2}} item(s), {{3}}, {{4}}, {{5}}.`
  The sender can be the shop's WhatsApp Business number (Meta "coexistence") or any other verified number.
- Couriers and their tracking links (`{id}` = tracking ID) are set under Admin → Settings.

## Store details
Contact phone, WhatsApp, email, address, hours and Instagram/Facebook links are edited under
Admin → Settings and appear in the footer, the Story page and on order confirmations. The seed fills
the store's details from its Google Maps listing (Tiruchengode); confirm the WhatsApp number and add an
email address there.

Live at https://ragaboutique.route34solutions.com (also https://raga-boutique.vercel.app). The subdomain
is a DNS-only CNAME in route34's Cloudflare pointing at Vercel.

## Not built yet
Online payments (Razorpay), SMS/WhatsApp order updates, GST invoices, courier booking, returns, coupons.
