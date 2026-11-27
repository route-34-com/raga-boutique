import type { ReactNode } from "react"
import { Link, NavLink, useParams } from "react-router"

import { ContactList } from "@/components/store/StoreLayout"
import { useSettings } from "@/hooks/queries"
import { useTitle } from "@/hooks/useTitle"
import { inr } from "@/lib/format"
import { onlineOn, paymentMethods, upiQrOn } from "@/lib/payment"
import type { StoreSettings } from "@/lib/types"
import { cn } from "@/lib/utils"
import NotFound from "@/pages/store/NotFound"

const UPDATED = "23 November 2026"

type Topic = { title: string; body: (s?: StoreSettings) => ReactNode }

const TOPICS: Record<string, Topic> = {
  shipping: {
    title: "Shipping & delivery",
    body: (s) => (
      <>
        <p>We ship across India from our showroom in Tiruchengode, Tamil Nadu.</p>
        <h2>Dispatch and delivery time</h2>
        <ul>
          <li>Orders are packed and dispatched within 2–3 working days of being confirmed.</li>
          <li>Delivery takes 3–6 working days after dispatch, depending on your pincode and the courier.</li>
          <li>Festive seasons, weather and courier delays can add a few days; we'll keep you posted.</li>
        </ul>
        <h2>Delivery charges</h2>
        <p>
          Delivery is free on orders above {inr(s?.free_ship_above ?? 5000)}. Below that, a flat {inr(s?.ship_fee ?? 150)} is
          added at checkout, shown before you place the order.
        </p>
        <h2>Tracking</h2>
        <p>
          Once your parcel ships, we send the courier name and tracking ID by WhatsApp and email. You can also see it under{" "}
          <Link to="/account">My orders</Link>.
        </p>
        <h2>Address</h2>
        <p>
          Please check your address and phone number at checkout. If a parcel comes back because the address was wrong or
          nobody was available, we'll contact you to arrange a re-delivery; the courier's charge for it is paid by the customer.
        </p>
      </>
    ),
  },
  returns: {
    title: "Cancellation & refunds",
    body: (s) => (
      <>
        <h2>Cancelling an order</h2>
        <ul>
          <li>You can cancel an order any time before it is dispatched. Message or call us with your order number.</li>
          <li>Once an order has been dispatched it can't be cancelled.</li>
          <li>
            We may cancel an order if a piece is out of stock or listed at a wrong price. If you have already paid, you get
            a full refund.
          </li>
          {onlineOn(s) && (
            <li>An online order that isn't paid within 30 minutes is cancelled automatically, and nothing is charged.</li>
          )}
        </ul>
        <h2>Returns and exchanges</h2>
        <p>
          Every piece is handpicked and checked before it is packed, so all sales are final: we don't accept returns or
          exchanges for a change of mind, colour or size.
        </p>
        <p>
          If your parcel arrives damaged, or you receive a different piece from the one you ordered, tell us within 48 hours
          of delivery with photos (an unboxing video helps). We'll replace it, or refund it in full if a replacement isn't
          available.
        </p>
        <h2>Refunds</h2>
        <ul>
          {onlineOn(s) && (
            <li>Payments made online through Razorpay are refunded to the same card, UPI account or bank account they came from.</li>
          )}
          {upiQrOn(s) && <li>Payments made by scanning our UPI QR code are refunded by UPI to the account they came from.</li>}
          <li>Refunds are started the day the cancellation is accepted and usually reach you in 5–7 working days, depending on your bank.</li>
          <li>Orders paid in cash or by UPI on delivery are refunded by bank transfer or UPI to the details you share with us.</li>
        </ul>
      </>
    ),
  },
  terms: {
    title: "Terms & conditions",
    body: (s) => (
      <>
        <p>
          This website is run by Raga Boutique, Tiruchengode, Tamil Nadu. By placing an order you agree to these terms, along
          with our <Link to="/policies/shipping">shipping</Link>, <Link to="/policies/returns">cancellation and refund</Link>{" "}
          and <Link to="/policies/privacy">privacy</Link> policies.
        </p>
        <h2>Products</h2>
        <p>
          We photograph every piece in daylight to show its true colour, but screens differ, and handwoven fabric can show small
          variations in weave and colour. These are part of a handmade piece, not defects.
        </p>
        <h2>Prices and payment</h2>
        <p>
          Prices are in Indian rupees and include applicable taxes; delivery charges are shown at checkout. You can pay{" "}
          {paymentMethods(s).join("; ")}.
        </p>
        <h2>Orders</h2>
        <p>
          An order is confirmed once we accept it; we let you know by WhatsApp and email. We may decline or cancel an order,
          with a full refund of anything paid, if a piece is unavailable, a price was listed in error, or the order looks
          fraudulent.
        </p>
        <h2>Your account</h2>
        <p>
          You sign in with a one-time code sent to your mobile number. Keep your phone secure; orders placed from your account
          are treated as yours.
        </p>
        <h2>Content</h2>
        <p>Photographs, text and the Raga name and logo belong to Raga Boutique and may not be reused without permission.</p>
        <h2>Liability and law</h2>
        <p>
          Our liability for any order is limited to the amount paid for it. These terms are governed by the laws of India, and
          any dispute is subject to the courts of Namakkal district, Tamil Nadu.
        </p>
      </>
    ),
  },
  privacy: {
    title: "Privacy policy",
    body: (s) => (
      <>
        <p>Raga Boutique collects only what it needs to take and deliver your orders.</p>
        <h2>What we collect</h2>
        <ul>
          <li>Your mobile number, to sign you in with a one-time code.</li>
          <li>Your name, email and delivery address, to deliver orders and send order updates.</li>
          <li>Your orders and reviews, so you can see them under My orders.</li>
        </ul>
        <h2>Payments</h2>
        {onlineOn(s) ? (
          <p>
            Online payments are handled by Razorpay. Your card, UPI and bank details go to Razorpay directly; we never see or
            store them.
          </p>
        ) : (
          <p>
            You pay {paymentMethods(s).join(", or ")}. We never see or store your card or bank details; if you pay by UPI,
            we only keep the UPI reference number to match your payment.
          </p>
        )}
        <h2>Who we share it with</h2>
        <p>
          Only the services needed to run your order: the courier (name, phone, address), and the services that send our SMS,
          WhatsApp and email messages. We don't sell or rent your details, and we don't send marketing messages without your
          consent.
        </p>
        <h2>Cookies and storage</h2>
        <p>
          We use one cookie to keep you signed in. Your bag and wishlist are saved in your own browser. We don't use
          advertising trackers.
        </p>
        <h2>Your choices</h2>
        <p>
          You can update your name, email and addresses under My account. To have your account and details deleted, contact
          us; order records we must keep for tax purposes are kept for the period the law requires.
        </p>
      </>
    ),
  },
  faq: {
    title: "Common questions",
    body: (s) => (
      <>
        <h2>How long does delivery take?</h2>
        <p>
          We dispatch within 2–3 working days of confirming your order, and delivery takes 3–6 working days after that,
          anywhere in India.
        </p>
        <h2>Is delivery free?</h2>
        <p>
          Yes, on orders above {inr(s?.free_ship_above ?? 5000)}. Below that, delivery is a flat {inr(s?.ship_fee ?? 150)}.
        </p>
        <h2>Can I pay cash on delivery?</h2>
        <p>Yes. You can pay {paymentMethods(s).join("; or ")}.</p>
        <h2>Can I return or exchange a saree?</h2>
        <p>
          All sales are final, so we don't take returns for a change of mind. If a piece arrives damaged or isn't the one you
          ordered, tell us within 48 hours of delivery with photos and we'll replace or refund it.{" "}
          <Link to="/policies/returns">Cancellation &amp; refunds</Link>
        </p>
        <h2>Do you do fall, pico and blouse stitching?</h2>
        <p>Yes, on request. Message us on WhatsApp after you order and we'll share the charges and time.</p>
        <h2>Can I see a saree on a video call first?</h2>
        <p>Yes. Message us on WhatsApp to book a video call and we'll show you the drape and the true colour in daylight.</p>
        <h2>How do I track my order?</h2>
        <p>
          Once it ships, we send the courier name and tracking ID by WhatsApp and email. It also shows under{" "}
          <Link to="/account">My orders</Link>.
        </p>
        <h2>Where is your showroom?</h2>
        <p>{s?.contact_address || "Tiruchengode, Tamil Nadu"}{s?.contact_hours ? `. Open ${s.contact_hours}.` : "."}</p>
      </>
    ),
  },
  contact: {
    title: "Contact us",
    body: (s) => (
      <>
        <p>
          Questions about a piece, an order or a refund? Message us, call, or visit the showroom. Want to see a drape or the
          true colour first? Book a video call and we'll walk you through the pieces.
        </p>
        <div className="mt-6">
          <p className="mb-3 font-semibold text-cocoa">Raga Boutique</p>
          <ContactList linkClass="text-cocoa hover:text-rust" />
          {!s && <p className="text-sm text-muted-foreground">Loading contact details…</p>}
        </div>
      </>
    ),
  },
}

export default function Policies() {
  const { topic = "" } = useParams()
  const { data: s } = useSettings()
  const page = TOPICS[topic]
  useTitle(page?.title)
  if (!page) return <NotFound />
  return (
    <section className="container-x grid gap-10 pb-6 pt-5 md:grid-cols-[220px_1fr] md:gap-16 md:pt-6">
      <nav aria-label="Policies" className="flex gap-2 overflow-x-auto md:flex-col md:gap-1 md:pt-14">
        {Object.entries(TOPICS).map(([id, t]) => (
          <NavLink
            key={id}
            to={`/policies/${id}`}
            className={({ isActive }) =>
              cn(
                "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold text-muted-foreground hover:text-cocoa md:rounded-lg",
                isActive && "bg-sand/60 text-cocoa",
              )
            }
          >
            {t.title}
          </NavLink>
        ))}
      </nav>
      <article className="max-w-[68ch]">
        <p className="eyebrow">Policies</p>
        <h1 className="mt-3.5 text-[clamp(32px,4vw,52px)] leading-none">{page.title}</h1>
        <p className="mt-3 text-xs text-muted-foreground">Last updated {UPDATED}</p>
        <div className="policy-text mt-8">{page.body(s)}</div>
      </article>
    </section>
  )
}
