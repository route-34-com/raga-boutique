# Order flow, notifications and bulk dispatch — design

Date: 22 Oct 2026 · Project: Raga Boutique (`~/raga-store`)

## Why

The owner wants a simple, predictable order flow: anyone can browse and fill a bag, login only happens at the point of buying, and every order step reaches the customer on WhatsApp and email without the owner typing messages by hand. The biggest time cost today is dispatch day — many orders go out with a courier at once, each with its own tracking ID, and each customer has to be told.

## Goals

1. **Guest bag, tab only.** Add to bag without login. The bag lives in the browser tab (sessionStorage) — it survives page reloads, not closing the tab. This stays true after login too (the owner's call: no account-saved bag).
2. **Leaving warning.** Closing or reloading-away from the tab with items in the bag triggers the browser's "Leave site?" prompt. Browsers don't allow custom text there, so the bag drawer also shows a one-line note: "Your bag is saved in this tab only — closing it clears the bag. Log in at checkout to place the order."
3. **Buy → login → details → place.** Unchanged in principle from today: Checkout requires phone + OTP login, then name, email (now **required**) and delivery address, then Place order (COD).
4. **No returns, no customer cancel.** Remove "7-day returns" from Home services, Product page accordion and Story page. Remove the customer Cancel button and its API (`POST /me/orders/{no}/cancel`). The owner can still cancel from admin.
5. **New order → owner alert.** When an order is placed: email to the shop's contact email; WhatsApp to the shop's WhatsApp once the API is connected. Admin nav shows a count of new (placed) orders.
6. **Owner accepts → customer told.** In admin, an order in `placed` gets an **Accept** button (moves to `confirmed`). On accept: "order accepted" email to the customer, and a WhatsApp message (see delivery modes).
7. **Bulk dispatch.** In admin Orders, a "Dispatch" view lists accepted (`confirmed`/`packed`) orders. Owner ticks orders, picks a courier (one per batch, changeable per row), types a tracking ID per order, sees a preview of the message, hits **Send**. Each order moves to `shipped` with courier + tracking ID saved, and each customer gets WhatsApp + email: "Hi {name}, your Raga order #{no} is on its way with {courier}. Tracking ID: {id}. Track: {link}".
8. **Courier list in Settings.** Admin → Settings gets a small courier list: name + tracking link pattern (e.g. `https://…/track?awb={id}`). Link is built from the pattern.
9. **Inventory admin** already exists (add/edit/remove products, stock per size). Keep as is; fix only bugs found on the way.

## Non-goals

- Online payment (stays COD).
- Saving the bag to the account or across devices.
- Returns or exchanges of any kind.
- Two-way WhatsApp chat or replies handling.
- Delivery-status syncing from courier APIs.

## Anti-goals

- A message going to the wrong customer, or the same message twice from a double-click. Sends must be idempotent per order + message type.
- The owner unable to tell whether a message actually went out. Every send is logged on the order's timeline (sent / opened-for-tap / failed + reason).
- Breaking the existing admin and storefront while the WhatsApp API is not yet approved.

## WhatsApp delivery

The owner decided: build for Meta's official WhatsApp Cloud API; use tap-to-send until it's approved. Sender number doesn't need to be the shop's own — the point is passing on the info.

- A `WhatsAppSender` interface like the existing OTP providers (`services/otp/`), with two modes chosen in config:
  - **`tap` (default now):** no message is sent by the server. Admin actions return the ready `wa.me/<customer>?text=…` link; the UI opens it (Accept) or shows a list of "Open WhatsApp" buttons, one per order, ticking each off as tapped (bulk dispatch). Owner new-order alert is email only in this mode.
  - **`cloud`:** server sends via Meta Cloud API with approved templates (`order_accepted`, `order_shipped`, `new_order_owner`). Config: phone-number ID, access token, template names/language.
- Switching from `tap` to `cloud` is a config change, no code change.

## Email delivery

Builder's call (recorded here): plain SMTP via a generic sender, configured by env vars (host, port, user, password, from address), so Brevo / Gmail app password / any provider works. Default suggestion Brevo free tier. If SMTP isn't configured, emails are logged to console (like `OTP_PROVIDER=console`) so the demo keeps working. Simple HTML + text emails in the cream/cocoa brand style.

## Data changes

- `OrderEvent` (existing timeline) records each notification: channel (whatsapp/email), kind (accepted/shipped/new_order), result.
- `couriers` stored in `StoreSettings` (JSON list of `{name, track_url}`) or a small table — builder's call.
- Order `email` becomes required at checkout for new orders (column stays, old orders untouched).

## Left to the builder

Exact wording of messages (keep short, warm, brand voice), admin layout of the Dispatch view, whether Dispatch is a tab on Orders or its own page, migration details, tests (extend the existing pytest suite for accept, bulk ship, idempotency, no-cancel).

## Calls I made (for the owner to check)

- Email is required at checkout.
- One courier per batch by default, editable per row.
- In tap mode, the owner's new-order alert is email + admin badge only.
- Admin can still cancel orders; customers can't.
