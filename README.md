<h1 align="center">Raga Boutique — Online Store & Admin Panel</h1>
<br>
<p align="center">
  <img src="https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/react-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/tailwindcss-0F172A?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white" alt="shadcn/ui">
  <img src="https://img.shields.io/badge/vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel">
</p>
<br>

👗 E-commerce store and admin panel for Raga Boutique, Tiruchengode.

The store is a full-stack app that combines:

   ⚡ **FastAPI + SQLAlchemy + Alembic + Postgres 16** for a typed API where prices, stock and order rules all run on the server

   🎨 **React + TypeScript + Vite + Tailwind + shadcn/ui** (with TanStack Query and Zustand) for the storefront and a lazy-loaded admin panel

   📲 **OTP login and order messages** by SMS, WhatsApp and email, each with a free demo mode

## Features

- **Storefront** — catalogue, search, sizes, bag and wishlist (saved in the browser), checkout with cash on delivery
- **OTP login** — phone number sign-in at checkout; 6-digit codes, valid 5 minutes, 5 wrong tries max
- **No overselling** — stock rows are locked while an order is placed, so two people can't buy the last piece
- **Order flow** — placed → confirmed → packed → shipped (with courier tracking) → delivered
- **Admin panel** — orders, dispatch, products, photos and store settings; shoppers never download it
- **Order messages** — new order, accepted and shipped messages by WhatsApp and email
- **Store details** — phone, WhatsApp, email, address, hours and social links edited in the admin panel

## Live Site

Live at **[ragaboutique.route34solutions.com](https://ragaboutique.route34solutions.com)** (also [raga-boutique.vercel.app](https://raga-boutique.vercel.app)).

## Installation

### Prerequisites

- [Python 3.12+](https://www.python.org/downloads/) and [uv](https://docs.astral.sh/uv/)
- [Node.js 20+](https://nodejs.org/)
- [PostgreSQL 16](https://www.postgresql.org/download/) (macOS: `brew services start postgresql@16`)
- [Git](https://git-scm.com/downloads)

### Step 1: Clone the Repository

**Option A: Using VS Code Terminal**
1. Open Visual Studio Code
2. Open a new terminal (Terminal → New Terminal or ``Ctrl+Shift+` ``)
3. Navigate to your desired directory:
   ```bash
   cd path/to/your/desired/folder
   ```
4. Clone the repository:
   ```bash
   git clone https://github.com/route-34-com/raga-boutique.git
   ```
5. Open the project folder:
   ```bash
   cd raga-boutique
   ```
6. Open the project in VS Code:
   ```bash
   code .
   ```

**Option B: Using VS Code Git Integration**
1. Open Visual Studio Code
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
3. Type "Git: Clone" and select it
4. Paste the repository URL: `https://github.com/route-34-com/raga-boutique.git`
5. Choose a folder location and click "Select Repository Location"
6. Click "Open" when prompted

### Step 2: Create the Databases

With Postgres 16 running, create a `raga` user, the main database and the test database:

```bash
psql -d postgres -c "CREATE ROLE raga LOGIN PASSWORD 'raga_dev'" -c "CREATE DATABASE raga OWNER raga" -c "CREATE DATABASE raga_test OWNER raga"
```

### Step 3: Set Up the Backend

```bash
cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m scripts.seed --demo
```

`uv sync` creates the virtual environment and installs dependencies; no manual activation is needed when using `uv run`.

### Step 4: Set Up the Frontend

```bash
cd ../frontend
npm install
```

## Configuration

All backend settings live in `backend/.env` (copied from `.env.example`):

```env
DATABASE_URL=postgresql+psycopg://raga:raga_dev@127.0.0.1:5432/raga
JWT_SECRET=dev-only-secret-change-me-in-production-0000
OTP_PROVIDER=console        # console = demo, msg91 = real SMS
WHATSAPP_MODE=tap           # tap = admin taps send, cloud = Meta WhatsApp Cloud API
EMAIL_PROVIDER=console      # console = logged only, smtp = sent
```

**Important:** set a long random `JWT_SECRET` and `COOKIE_SECURE=true` in production.

### Switching On Real SMS

Set in `backend/.env`: `OTP_PROVIDER=msg91`, `MSG91_AUTHKEY`, `MSG91_TEMPLATE_ID` (a DLT-approved template with an `##otp##` variable).
Another provider = one new file in `app/services/otp/` + one line in its `__init__.py`.

### Switching On WhatsApp and Email

Until set up, WhatsApp runs in **tap** mode (admin gets "Open WhatsApp" with the message typed; owner taps send) and email in **console** mode (logged only).

- **Email** — `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`.
  Brevo free plan: host `smtp-relay.brevo.com`, port 587 (STARTTLS; port 465 is not supported), 300 emails/day. Also set the shop email under Admin → Settings for new-order alerts.
- **WhatsApp Cloud API (Meta)** — `WHATSAPP_MODE=cloud`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN` (permanent system-user token), `WHATSAPP_LANG` (`en`). Create four **Utility** templates with these names and body variables, in this order:
  - `order_accepted`: `Hi {{1}}, your Raga order {{2}} is confirmed. We'll message you the tracking details once it ships. Total {{3}} (cash on delivery).`
  - `order_shipped`: `Hi {{1}}, your Raga order {{2}} is on its way with {{3}}. Tracking ID: {{4}}. Track it here: {{5}}`
  - `order_delivered`: `Hi {{1}}, your Raga order {{2}} has been delivered. Hope you love it! Rate your order here: {{3}}`
  - `new_order_owner`: `New order {{1}}: {{2}} item(s), {{3}}, {{4}}, {{5}}.`

  The sender can be the shop's WhatsApp Business number (Meta "coexistence") or any other verified number.
- **Couriers** and their tracking links (`{id}` = tracking ID) are set under Admin → Settings.

### Store Details

Contact phone, WhatsApp, email, address, hours and Instagram/Facebook links are edited under Admin → Settings and appear in the footer, the Story page and on order confirmations. The seed fills the store's details from its Google Maps listing (Tiruchengode); confirm the WhatsApp number and add an email address there.

## Usage

### Running Locally

**Terminal 1 — API on port 8000** (docs at http://127.0.0.1:8000/api/docs):
```bash
cd backend && uv run uvicorn app.main:app --reload --reload-dir app
```

**Terminal 2 — site on port 5173** (proxies `/api` and `/uploads` to the API):
```bash
cd frontend && npm run dev
```

- **Store** — http://localhost:5173
- **Admin** — http://localhost:5173/admin (log in with **9000000001**)
- **Test customers** with order history — **9000000002** to **9000000006**. Any other number signs up as a new customer

In demo mode (`OTP_PROVIDER=console`) no SMS is sent: the code appears on screen and in the API log.

### Resetting the Demo

Wipes orders and photos, then reloads the catalogue:

```bash
cd backend && uv run python -m scripts.seed --demo --reset
```

### Running Tests

```bash
cd backend && uv run pytest        # uses the raga_test database (override with TEST_DATABASE_URL)
```

Covers OTP login and lockout, server-side prices, no overselling (row locks), duplicate cart lines, cancellation restocking, the order status flow, admin-only access, search, plain-language validation errors and contact settings.

## Rules Worth Knowing

- Prices and stock are always read from the database at checkout; the browser only sends product, size and quantity
- Stock rows are locked while an order is placed, so two people can't buy the last piece
- Order flow: placed → confirmed (owner presses Accept) → packed → shipped (courier + tracking required) → delivered. Admins can skip ahead, never go back. Only admins can cancel; it puts stock back. No returns. COD orders are marked paid on delivery
- The bag lives in the browser tab only (sessionStorage); closing the tab asks first. Login happens at checkout; email is required
- Messages: new order → shop email (+ WhatsApp in cloud mode); Accept → customer WhatsApp + email; shipped (Admin → Dispatch, one tracking ID per order) → customer WhatsApp + email with the tracking link; delivered → customer WhatsApp + email asking for a review, with a link to their order. Each message goes out once per order and shows on the order
- Orders keep their own copy of the address, product name, price and photo, so editing or deleting a product never changes old orders
- OTP: 6 digits, valid 5 minutes, 5 wrong tries max, 30 s between resends, 5 per hour per number

## Deployment (Vercel)

Every push to `main` deploys to production; other branches get a preview URL. `vercel.json` builds the frontend and serves the API as one Python function (`api/index.py`); the catalogue photos are copied into the build so the CDN serves them directly.

The database is Neon Postgres (Vercel Marketplace, Singapore), which sets `DATABASE_URL`. The project also needs: `ENV=demo`, `OTP_PROVIDER=console` (or `msg91`), `JWT_SECRET`, `COOKIE_SECURE=true`, `IMAGE_STORE=db` (Vercel has no lasting disk, so uploaded photos are kept in Postgres) and `SERVERLESS=true`. Preview deployments share the production database.

Migrations don't run on deploy. After adding one, run it against Neon (use the unpooled URL):

```bash
vercel env pull .env.production.local --environment production
cd backend && DATABASE_URL="<DATABASE_URL_UNPOOLED>" IMAGE_STORE=db uv run alembic upgrade head
```

If backend dependencies change, regenerate `requirements.txt` (command at the top of that file).

The `ragaboutique.route34solutions.com` subdomain is a DNS-only CNAME in route34's Cloudflare pointing at Vercel. `deploy/` holds an alternative droplet setup (low-RAM Postgres config, systemd service, Caddyfile).

## Troubleshooting

- **API won't start / database errors** — make sure Postgres 16 is running and the `raga` user and databases exist (Step 2)
- **Missing tables** — run `uv run alembic upgrade head` in `backend/`
- **No OTP SMS arrives** — in demo mode none is sent; the code is on screen and in the API log
- **Tests fail to connect** — create the `raga_test` database or set `TEST_DATABASE_URL`
- **New column missing in production** — migrations don't run on deploy; run them against Neon by hand
- **Emails fail with Brevo** — use port 587 (STARTTLS); port 465 is not supported

## Not Built Yet

Online payments (Razorpay), SMS/WhatsApp order updates, GST invoices, courier booking, returns, coupons.

## Project Structure

```
raga-boutique/
├── backend/                     # FastAPI · SQLAlchemy · Alembic · Postgres 16 · pytest
│   ├── app/
│   │   ├── core/                # Settings (.env), database session, session cookie (JWT), auth
│   │   ├── models/              # Users, addresses, OTP codes, products, variants, images, orders, settings
│   │   ├── schemas/             # Request/response shapes
│   │   ├── services/            # orders.py, auth.py (OTP), otp/ (SMS senders), images.py
│   │   └── routers/             # auth, catalog (public), account (customer), admin/*
│   ├── alembic/                 # Database migrations
│   ├── scripts/seed.py          # Demo catalogue and test accounts
│   ├── tests/                   # Pytest suite
│   └── .env.example             # Environment template
├── frontend/src/                # React · TypeScript · Vite · Tailwind · shadcn/ui
│   ├── components/ui/           # shadcn components
│   ├── components/common/       # OTP login form, status badge, order timeline
│   ├── components/store/        # Storefront pieces (pages in pages/store/)
│   ├── components/admin/        # Admin panel pieces (pages in pages/admin/, lazy-loaded)
│   ├── hooks/queries.ts         # Data fetching
│   ├── lib/api.ts               # API client
│   └── stores/                  # Bag + wishlist, login dialog
├── api/index.py                 # Vercel Python function entry
├── deploy/                      # Droplet setup: Postgres config, systemd service, Caddyfile
├── vercel.json                  # Vercel build and routing
├── requirements.txt             # Backend dependencies for Vercel
└── README.md                    # This documentation
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

In case of any queries, please leave a message or contact me via the email provided in my profile.

<p align="center">
⭐ <strong>Star this repository if you found it helpful!</strong>
</p>
