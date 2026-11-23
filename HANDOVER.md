# Raga Boutique — Handover

For the team taking over hosting and maintenance. The README covers local setup, features and rules; this file covers
what is left to do before and after going live.

## 1. State at handover

- **Feature-complete for launch**: storefront, OTP login, checkout (cash/UPI on delivery, UPI QR, Razorpay), order flow
  with dispatch and tracking, reviews, admin panel with business pages (purchases, expenses, staff), super admins.
- **Checks**: 79 backend tests pass; backend is ruff-clean and ruff-formatted; the frontend type-checks and builds.
- **Every integration is built and switched by settings.** Out of the box they run in demo mode, so nothing needs a
  key to try the app. Going live means creating the shop's accounts and filling in `backend/.env` (section 2).
- **Demo site**: currently hosted on Vercel with a Neon Postgres database. If the shop has added or edited real
  products there, take a `pg_dump` of that database before it is switched off and restore it into production.
- **Domain**: `ragaboutique.in` (GoDaddy). Point an A record for `@` and `www` at the production server.
- **Policy pages** (`/policies/terms`, `privacy`, `shipping`, `returns`, `contact`) are linked in the footer; Razorpay
  checks them before activating an account. Their text is in `frontend/src/pages/store/Policies.tsx`; contact details,
  delivery charges and payment methods are filled in from Admin → Settings. Confirm the returns rule with the shop.

## 2. Integrations to switch on

Accounts should be created in the shop's name, not a developer's, so they survive any change of team.

| Integration | Used for | Account needed | Settings in `.env` | Notes |
|---|---|---|---|---|
| **Email** | Order emails to customers, new-order alert to the shop | Brevo (free: 300/day) | `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Verify the sender domain in Brevo (SPF/DKIM DNS records) or mail lands in spam. Port 587; 2525 on DigitalOcean |
| **Login codes (SMS)** | Phone OTP sign-in | MSG91 + a DLT registration (TRAI) | `OTP_PROVIDER=msg91`, `MSG91_AUTHKEY`, `MSG91_TEMPLATE_ID` | **Required for production**: `ENV=prod` refuses to start with on-screen codes. DLT approval of the template takes days; start early. Another SMS provider = one file in `app/services/otp/` |
| **WhatsApp order messages** | Accepted, shipped, delivered, and new-order alert | Meta Business + WhatsApp Cloud API | `WHATSAPP_MODE=cloud`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_LANG` | Until then `tap` mode works with no account: the admin taps send in WhatsApp. Four Utility templates must be approved first; exact names and text are in the README |
| **Online payments** | Razorpay Checkout (UPI, cards, netbanking) | Razorpay (business KYC) | `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Add the webhook `https://<domain>/api/payments/razorpay/webhook` for `payment.captured`. Try with `rzp_test_` keys first |
| **UPI QR** | Customer pays the shop's UPI ID by QR | None | None | Set the UPI ID and name under Admin → Settings |

Every setting, with its meaning, is in [`backend/.env.example`](backend/.env.example).

## 3. Production checklist

`backend/.env` on the server:

- [ ] `ENV=prod`
- [ ] `DATABASE_URL` to the production Postgres 16
- [ ] `JWT_SECRET` set to a new long random value (`openssl rand -hex 32`)
- [ ] `COOKIE_SECURE=true` (the site must be on HTTPS)
- [ ] `PUBLIC_SITE_URL=https://ragaboutique.in`
- [ ] `IMAGE_STORE=disk` on a server with a lasting disk (`db` only on serverless hosts), and `SERVERLESS=false`
- [ ] `SUPER_ADMIN_PHONES` set to the shop owner's number(s), e.g. `["98XXXXXXXX"]`; they alone add or remove admins
- [ ] `OTP_PROVIDER=msg91` with its keys, plus the keys of every other integration being switched on

First launch:

1. `uv sync --no-dev && uv run python -m alembic upgrade head`
2. `uv run python -m scripts.seed --admin <owner's 10-digit mobile>` loads the catalogue and the first admin,
   with no demo customers or orders. Skip this when restoring the demo database instead.
3. Build the frontend (`npm ci && npm run build`) and serve `frontend/dist`, `/api` and `/uploads` as in
   [`deploy/Caddyfile`](deploy/Caddyfile).
4. In Admin → Settings: shop phone, WhatsApp, email (receives new-order alerts), address, hours, social links,
   couriers and tracking links, UPI ID, delivery fee and free-delivery threshold.
5. Place a test order end to end on each payment method, then cancel it to check restocking and refund.
6. Set up daily backups of the database and the uploads folder (see `deploy/README.md`).

## 4. Deploy rules

- **Run `alembic upgrade head` on every deploy, before the new API starts.** Skipping it after a model change makes
  endpoints fail with 500s. This happened once on the demo host, which does not run migrations by itself.
- Keep the tests, ruff and the frontend build passing before deploying (`README.md` → Lint and Format).
- `vercel.json`, `api/index.py` and `requirements.txt` are only for Vercel hosting; delete them if not using Vercel.

## 5. Known gaps

- **Not built**: GST invoices, courier booking, returns, coupons, login codes by WhatsApp (only SMS today).
- **No frontend automated tests**; the backend has 79.
- **Frontend lint warnings (33, no errors)**: 25 are the usual "file exports more than components" note on shadcn
  files; 8 are "set state in an effect" or `new Date()` during render, used to fill forms from loaded data and to name
  export files. They work as intended; tidy them up when those pages are next changed.
