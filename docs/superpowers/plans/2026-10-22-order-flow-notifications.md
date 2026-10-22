# Order Flow, Notifications and Bulk Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tab-only guest bag with a leave warning, no returns/customer-cancel, owner Accept → customer notified, bulk dispatch with per-order tracking IDs, WhatsApp (tap now, Cloud API later) + email notices.

**Architecture:** A new `app/services/notify/` package owns message text, email senders (console/SMTP) and WhatsApp senders (tap/cloud). `services/orders.py` calls it after each committed transition; every attempt is a row in a new `notifications` table, unique per (order, kind, channel) so repeats never resend. Admin gets an Accept button, a Dispatch page and a courier list in Settings.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + Postgres, pytest; React + TS + Vite + shadcn + zustand + TanStack Query.

**Spec:** `docs/superpowers/specs/2026-10-22-order-flow-notifications-design.md`

## Global Constraints

- Branch `order-flow`. Backend tests: `cd backend && uv run pytest -q`. Frontend check: `cd frontend && npx tsc -b`.
- Payments stay COD. No returns or exchanges anywhere in the copy. Customers cannot cancel; admin can.
- Bag is `sessionStorage` only, also after login. Wishlist stays in `localStorage`.
- WhatsApp mode from env `WHATSAPP_MODE`: `tap` (default) or `cloud`. Email from env `EMAIL_PROVIDER`: `console` (default) or `smtp`. Switching modes needs no code change.
- A notification failure never blocks or rolls back an order change; it is recorded as `failed` with the reason.
- Message copy (exact):
  - accepted: `Hi {first_name}, your Raga order {order_no} is confirmed. We'll message you the tracking details once it ships. Total {total} (cash on delivery).`
  - shipped: `Hi {first_name}, your Raga order {order_no} is on its way with {courier}. Tracking ID: {tracking_id}. Track it here: {link}`
  - new_order (owner): `New order {order_no}: {item_count} item(s), {total}, {customer_name}, {city}.`
  - `{total}` formatted `₹18,400`; `{link}` omitted (sentence `Track it here: …` dropped) when the courier has no pattern.

## Review Focus

1. Admin double-clicks Accept or Send → each customer gets exactly one message per kind and channel (unique constraint + check-before-send). Test in Task 1 and Task 3.
2. Bulk dispatch where one order was cancelled meanwhile → that row fails with a plain reason, the others ship. Test in Task 3.
3. Customer has no email on an old order → email skipped and recorded as `skipped`, WhatsApp still prepared. Test in Task 2.
4. SMTP down / wrong password → order still moves, notification `failed` with reason shown on the admin timeline. Test in Task 2.
5. Customer phone with `+91` → wa.me link uses `91XXXXXXXXXX` digits only; text is URL-encoded. Test in Task 1.

---

### Task 1: Notification model, message text, WhatsApp senders

**Files:**
- Create: `backend/app/models/notification.py`, `backend/app/services/notify/__init__.py`, `backend/app/services/notify/messages.py`, `backend/app/services/notify/whatsapp.py`, `backend/alembic/versions/e5a1b7c3d9f2_notifications_and_couriers.py`
- Modify: `backend/app/models/__init__.py` (export `Notification`), `backend/app/models/settings.py` (add `couriers`), `backend/app/core/config.py`
- Test: `backend/tests/test_notify.py`

**Interfaces:**
- Produces:
  - `Notification(order_id:int, kind:str, channel:str, status:str, detail:str, created_at)`; `kind ∈ {"accepted","shipped","new_order"}`, `channel ∈ {"whatsapp","email"}`, `status ∈ {"sent","tap","logged","skipped","failed"}`; `UniqueConstraint(order_id, kind, channel)`; `Order.notifications` relationship ordered by id.
  - `StoreSettings.couriers: list[dict]` JSON, default `[]`, items `{"name": str, "track_url": str}` where `track_url` contains `{id}`.
  - Settings: `whatsapp_mode="tap"`, `whatsapp_phone_id=""`, `whatsapp_token=""`, `whatsapp_lang="en"`, `email_provider="console"`, `smtp_host=""`, `smtp_port=587`, `smtp_user=""`, `smtp_password=""`, `email_from=""`, `public_site_url="http://localhost:5173"`.
  - `messages.render(kind:str, order:Order, couriers:list[dict]) -> str` (copy above) and `messages.track_link(courier:str, tracking_id:str, couriers:list[dict]) -> str` (`""` if not found).
  - `whatsapp.wa_link(phone:str, text:str) -> str` → `https://wa.me/91XXXXXXXXXX?text=<urlencoded>`.
  - `whatsapp.send(to_phone:str, kind:str, text:str, params:list[str]) -> tuple[str, str]` returning `(status, detail)`: tap mode → `("tap", wa_link)`; cloud mode → POST Graph API template message (`https://graph.facebook.com/v21.0/{phone_id}/messages`, template name = kind, body params) → `("sent", message_id)` or `("failed", reason)`.

- [ ] **Step 1: Write failing tests** in `test_notify.py`: `test_wa_link_strips_plus_and_encodes` (`wa_link("+919876543210", "Hi & bye")` == `"https://wa.me/919876543210?text=Hi%20%26%20bye"`); `test_render_shipped_with_link` (courier `{"name":"DTDC","track_url":"https://t.example/?awb={id}"}` → text contains `Tracking ID: X1` and `https://t.example/?awb=X1`); `test_render_shipped_without_pattern_drops_link_sentence`; `test_render_accepted_formats_total` (`₹11,800`); `test_tap_mode_send_returns_link`.
- [ ] **Step 2: Run** `uv run pytest tests/test_notify.py -q` → FAIL (import errors).
- [ ] **Step 3: Implement** model, config fields, `messages.py`, `whatsapp.py` (use `httpx` already in deps — check `pyproject.toml`; add with `uv add httpx` if absent). Migration: create `notifications` table + add `store_settings.couriers` JSON server_default `'[]'`.
- [ ] **Step 4: Run** `uv run alembic upgrade head && uv run pytest -q` → all pass.
- [ ] **Step 5: Commit** `feat: notification records, message text and WhatsApp senders`.

### Task 2: Email sender and the `notify()` orchestrator

**Files:**
- Create: `backend/app/services/notify/email.py`, `backend/app/services/notify/templates.py`
- Modify: `backend/app/services/notify/__init__.py`
- Test: `backend/tests/test_notify.py`

**Interfaces:**
- Consumes: Task 1 interfaces.
- Produces:
  - `email.send(to:str, subject:str, text:str, html:str) -> tuple[str, str]`: console → log + `("logged", "")`; smtp → `smtplib.SMTP(host, port)` + `starttls` + login → `("sent", "")`, any exception → `("failed", str(e)[:200])`.
  - `notify(db:Session, order:Order, kind:str) -> list[Notification]`: for `accepted`/`shipped` sends to the customer (WhatsApp to `order.phone`, email to `order.email`); for `new_order` sends to the shop (`contact_whatsapp`, `contact_email` from `store_settings`; WhatsApp only in cloud mode, otherwise no WhatsApp row). Skips a channel if a row for (order, kind, channel) exists. Empty email → row `skipped`. Commits its own rows; never raises.
  - Subjects: accepted `Your Raga order {order_no} is confirmed`; shipped `Your Raga order {order_no} has shipped`; new_order `New order {order_no}`. HTML: cream `#f6efe6` background, cocoa `#3d1d0f` text, the same message text + an items list.

- [ ] **Step 1: Write failing tests**: `test_notify_accepted_creates_tap_and_logged_rows`; `test_notify_twice_sends_once` (second call returns `[]`, row count stays 2); `test_no_email_is_skipped`; `test_smtp_failure_recorded` (monkeypatch `smtplib.SMTP` to raise `OSError("refused")`, `EMAIL_PROVIDER=smtp` → email row `failed` with `refused` in detail); `test_new_order_tap_mode_emails_shop_only`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `email.py`, `templates.py`, `notify()`.
- [ ] **Step 4: Run** `uv run pytest -q` → pass.
- [ ] **Step 5: Commit** `feat: email sender and notify() with one-send-per-kind`.

### Task 3: Wire into orders — new order, Accept, bulk dispatch, no customer cancel, email required

**Files:**
- Modify: `backend/app/services/orders.py`, `backend/app/routers/admin/orders.py`, `backend/app/routers/account.py`, `backend/app/models/order.py`, `backend/app/schemas/account.py`, `backend/app/schemas/order.py`, `backend/app/schemas/admin.py`, `backend/app/routers/admin/settings.py`
- Test: `backend/tests/test_orders.py`

**Interfaces:**
- Consumes: `notify(db, order, kind)`.
- Produces:
  - `place_order` calls `notify(db, order, "new_order")` after commit. `PlaceOrderIn.email: EmailStr` (required).
  - `set_status` calls `notify(..., "accepted")` on → `confirmed` and `notify(..., "shipped")` on → `shipped`, after commit.
  - Remove `cancel_by_customer`, `CUSTOMER_CANCELLABLE` and `POST /me/orders/{no}/cancel`.
  - `OrderDetail` gains `notifications: list[NotificationOut]` (`kind, channel, status, detail, created_at`); `detail` holds the wa.me link for `tap` rows.
  - `POST /api/admin/orders/dispatch` body `DispatchIn{items: list[{order_id:int, courier:Short, tracking_id:Short}]}` (1–100 items) → `list[DispatchResult{order_id:int, order_no:str, ok:bool, error:str, whatsapp_link:str}]`; each item runs `set_status(..., "shipped", courier=..., tracking_id=...)` independently; a `ServiceError` becomes `ok=False, error=message`.
  - `SettingsIn.couriers: list[CourierIn{name: Short, track_url: str (≤300, must contain "{id}" or be empty)}]`, max 20.

- [ ] **Step 1: Update tests**: delete `test_customer_cancel_restocks`, change line 77 to assert the cancel route returns 404/405; make `place()` helper send `email`; add `test_email_required_at_checkout` (422 without email); `test_accept_records_customer_notices` (status confirmed → detail `notifications` has a whatsapp `tap` row with `wa.me/919876543210` and an email row); `test_bulk_dispatch_ships_each_and_reports_failures` (3 orders, one admin-cancelled first → results `[ok, ok, not ok]`, ok orders have their own tracking IDs); `test_dispatch_twice_does_not_resend` (second dispatch of a shipped order → `ok=False`, notification count unchanged); `test_settings_save_couriers`.
- [ ] **Step 2: Run** `uv run pytest -q` → new tests FAIL.
- [ ] **Step 3: Implement** the changes above.
- [ ] **Step 4: Run** `uv run pytest -q` → all pass.
- [ ] **Step 5: Commit** `feat: owner accept and bulk dispatch notify customers; drop customer cancel`.

### Task 4: Storefront — tab-only bag, leave warning, required email, no returns or cancel

**Files:**
- Modify: `frontend/src/stores/cart.ts`, `frontend/src/components/store/StoreLayout.tsx`, `frontend/src/components/store/CartSheet.tsx`, `frontend/src/pages/store/Checkout.tsx`, `frontend/src/pages/store/OrderPage.tsx`, `frontend/src/pages/store/Home.tsx`, `frontend/src/pages/store/ProductPage.tsx`, `frontend/src/pages/store/Story.tsx`, `frontend/src/lib/types.ts`

**Interfaces:**
- Consumes: Task 3 API (`email` required; cancel route gone).

- [ ] **Step 1:** `cart.ts`: split persistence — `lines` to `sessionStorage`, `wishlist` to `localStorage` (two persisted slices or `partialize` + a separate wishlist store; keep `useCart` API unchanged). Old `localStorage` lines are dropped (bump `version`).
- [ ] **Step 2:** In `StoreLayout`, a `beforeunload` listener active only while `lines.length > 0` (`e.preventDefault(); e.returnValue = ""`). Do not fire after a successful order (lines are cleared then).
- [ ] **Step 3:** `CartSheet`: under the total, muted 13px note: `Your bag is kept in this tab only. Closing the tab clears it.`
- [ ] **Step 4:** `Checkout`: email input `required`, placeholder `For your order confirmation`, send `email` (no `|| null`); show the API error if invalid.
- [ ] **Step 5:** Remove: Home `SERVICES` "7-day returns" entry → replace with `["✉", "Updates on WhatsApp", "Order confirmation and tracking, straight to your phone."]`; ProductPage accordion title `Shipping` and text without the returns sentences; Story `returns` column → `["orders", "Orders", "We confirm every order on WhatsApp and email, then send the tracking ID once it ships. All sales are final."]`; OrderPage cancel mutation and button.
- [ ] **Step 6: Verify** `npx tsc -b` passes; with Playwright at 1470×735: add to bag, reload → bag kept; open in a new tab → bag empty; close attempt with items → `beforeunload` registered (`page.on("dialog")` fires on `page.close({runBeforeUnload:true})`); `grep -rni "7-day\|returns within" src` → nothing.
- [ ] **Step 7: Commit** `feat: tab-only bag with leave warning; email required; remove returns and cancel`.

### Task 5: Admin — Accept, notification timeline, Dispatch page, couriers in Settings

**Files:**
- Modify: `frontend/src/components/admin/OrderSheet.tsx`, `frontend/src/components/admin/AdminLayout.tsx` (nav item), `frontend/src/pages/admin/Settings.tsx`, `frontend/src/lib/types.ts`, router file that lists admin routes (find with `grep -rn "admin/orders\|Orders\"" frontend/src/*.tsx`)
- Create: `frontend/src/pages/admin/Dispatch.tsx`

**Interfaces:**
- Consumes: Task 3 endpoints and `OrderDetail.notifications`.

- [ ] **Step 1:** `OrderSheet`: when status is `placed`, primary button label `Accept order` (status `confirmed`). After success, if the response has a `whatsapp`/`tap` row for `accepted`, `window.open(detail)` and toast `Email sent. WhatsApp opened with the message — tap send.`. Timeline lists notifications: `WhatsApp · Order accepted · Ready to tap [Open]` / `Email · Shipped · Sent` / `Failed: <reason>`.
- [ ] **Step 2:** `Dispatch.tsx` at `/admin/dispatch`, nav label `Dispatch`: table of orders with status `confirmed` or `packed` (`/api/admin/orders?status=confirmed` + `packed`), each row: checkbox, order no, name, city, courier select (defaults to the batch courier chosen at the top), tracking ID input. Below: preview of the shipped message for the first ticked row. `Send to N customers` button (disabled while any ticked row lacks a tracking ID) → `POST /api/admin/orders/dispatch`. Results list: ✓ rows with an `Open WhatsApp` button each (marks itself done when clicked), ✗ rows with the error. Invalidate `["admin"]` queries after.
- [ ] **Step 3:** `Settings`: "Couriers" card — rows of name + tracking link inputs, add/remove, helper text `Use {id} where the tracking ID goes, e.g. https://www.dtdc.in/tracking?awb={id}`; saved with the existing settings PUT.
- [ ] **Step 4: Verify** `npx tsc -b`; Playwright as admin (9000000001, console OTP): place 3 demo orders as customer, Accept each, open Dispatch, enter 3 tracking IDs, Send → 3 ✓ rows, orders show Shipped, backend log shows 3 emails. Screenshot Dispatch at 1470×735 and phone width 390.
- [ ] **Step 5: Commit** `feat: admin accept, dispatch page and courier settings`.

### Task 6: Docs and env

**Files:**
- Modify: `backend/.env.example` (or create if absent), `README.md` / existing deployment doc

- [ ] **Step 1:** Document `WHATSAPP_MODE`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_LANG`, `EMAIL_PROVIDER`, `SMTP_*`, `EMAIL_FROM`, `PUBLIC_SITE_URL`, and the three Meta template names/bodies (`accepted`, `shipped`, `new_order`) with numbered params in the copy order above.
- [ ] **Step 2:** Full run: `uv run pytest -q` and `npx tsc -b` pass.
- [ ] **Step 3: Commit** `docs: WhatsApp and email setup`.
