"""Text of the story and policy pages, sent in the HTML for search engines.

Shoppers see the React versions (frontend/src/pages/store/Story.tsx and Policies.tsx). When changing a policy, change
both; tests/test_pages.py checks that the key facts (days, hours, courts) match.
"""

from html import escape as e

from app.models import StoreSettings
from app.services import payments


def rupees(n: int) -> str:
    """Indian grouping: ₹1,23,450."""
    s = str(int(n))
    if len(s) <= 3:
        return f"₹{s}"
    head, pairs = s[:-3], []
    while len(head) > 2:
        pairs.insert(0, head[-2:])
        head = head[:-2]
    return f"₹{','.join([head, *pairs])},{s[-3:]}"


def online_on() -> bool:
    return payments.provider() != "off"


def upi_qr_on(s: StoreSettings) -> bool:
    return bool(s.upi_id) and not online_on()


def payment_methods(s: StoreSettings) -> list[str]:
    ways = ["cash or any UPI app on delivery"]
    if upi_qr_on(s):
        ways.append("UPI to our shop's UPI ID by QR code at checkout")
    if online_on():
        ways.append("UPI, cards, netbanking or wallets online through Razorpay")
    return ways


def _ul(items: list[str]) -> str:
    return "<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"


def story(s: StoreSettings) -> str:
    return (
        "<main><h1>The music of colours</h1>"
        "<h2>Meet Suja and her daughter: thirteen years of handpicked colour</h2>"
        "<p>Raga began in 2013 as a small boutique in Tiruchengode, built on a simple idea: every woman deserves a saree "
        "that makes her feel confident. Suja and her daughter still choose each piece themselves. They feel the weave, "
        "watch how it falls and check the colour in daylight.</p>"
        "<p>Today Raga has a larger showroom on Erode Main Road. Suja welcomes everyone who walks in, and her daughter "
        "brings every new arrival to you on Instagram and WhatsApp. Either way, you're treated like family.</p>"
        "<h2>Why ragas? A colour sets a mood before a word is said</h2>"
        "<p>In Indian classical music every raga belongs to an hour and a feeling — Bhairavi for morning, Yaman for "
        "dusk, Megh for the rains. When we choose a weave, we ask the same question: what time of day does this belong "
        "to, and how should it make you feel?</p>"
        "<p>We work directly with weaving families in Kanchipuram and Varanasi, buy in small batches, and photograph "
        "every piece in daylight so the colour you see is the colour you get.</p>"
        f"<h3>Shipping</h3><p>Dispatched in 2–3 days and delivered across India in 3–6 working days. Free above "
        f"{rupees(s.free_ship_above)}, otherwise {rupees(s.ship_fee)}. Every parcel is insured.</p>"
        f"<h3>Orders &amp; payment</h3><p>Pay {e('; or '.join(payment_methods(s)))}. We confirm every order on WhatsApp "
        "and email, then send the tracking ID once it ships. All sales are final; see "
        '<a href="/policies/returns">cancellation and refunds</a>.</p>'
        "<h3>Saree care</h3><p>Dry clean silks. Store folded in muslin, never plastic. Refold along new lines every few "
        "months so the zari doesn't crack.</p>"
        f"{contact(s)}</main>"
    )


def contact(s: StoreSettings) -> str:
    lines = []
    if s.contact_whatsapp or s.contact_phone:
        n = s.contact_whatsapp or s.contact_phone
        lines.append(f"WhatsApp / call: +91 {e(n)}")
    if s.contact_email:
        lines.append(f'Email: <a href="mailto:{e(s.contact_email)}">{e(s.contact_email)}</a>')
    if s.contact_address:
        lines.append(f"Showroom: {e(s.contact_address)}")
    if s.contact_hours:
        lines.append(f"Hours: {e(s.contact_hours)}")
    return f"<h3>Contact</h3>{_ul(lines)}" if lines else ""


def policy(topic: str, s: StoreSettings) -> str:
    return {
        "shipping": lambda: (
            "<p>We ship across India from our showroom in Tiruchengode, Tamil Nadu.</p>"
            "<h2>Dispatch and delivery time</h2>"
            + _ul(
                [
                    "Orders are packed and dispatched within 2–3 working days of being confirmed.",
                    "Delivery takes 3–6 working days after dispatch, depending on your pincode and the courier.",
                    "Festive seasons, weather and courier delays can add a few days; we'll keep you posted.",
                ]
            )
            + f"<h2>Delivery charges</h2><p>Delivery is free on orders above {rupees(s.free_ship_above)}. Below that, a "
            f"flat {rupees(s.ship_fee)} is added at checkout, shown before you place the order.</p>"
            "<h2>Tracking</h2><p>Once your parcel ships, we send the courier name and tracking ID by WhatsApp and email. "
            "You can also see it under My orders.</p>"
            "<h2>Address</h2><p>Please check your address and phone number at checkout. If a parcel comes back because "
            "the address was wrong or nobody was available, we'll contact you to arrange a re-delivery; the courier's "
            "charge for it is paid by the customer.</p>"
        ),
        "returns": lambda: (
            "<h2>Cancelling an order</h2>"
            + _ul(
                [
                    "You can cancel an order any time before it is dispatched. Message or call us with your order number.",
                    "Once an order has been dispatched it can't be cancelled.",
                    "We may cancel an order if a piece is out of stock or listed at a wrong price. If you have already "
                    "paid, you get a full refund.",
                    *(
                        [
                            "An online order that isn't paid within 30 minutes is cancelled automatically, and nothing is charged."
                        ]
                        if online_on()
                        else []
                    ),
                ]
            )
            + "<h2>Returns and exchanges</h2><p>Every piece is handpicked and checked before it is packed, so all sales "
            "are final: we don't accept returns or exchanges for a change of mind, colour or size.</p>"
            "<p>If your parcel arrives damaged, or you receive a different piece from the one you ordered, tell us within "
            "48 hours of delivery with photos (an unboxing video helps). We'll replace it, or refund it in full if a "
            "replacement isn't available.</p><h2>Refunds</h2>"
            + _ul(
                [
                    *(
                        [
                            "Payments made online through Razorpay are refunded to the same card, UPI account or bank "
                            "account they came from."
                        ]
                        if online_on()
                        else []
                    ),
                    *(
                        ["Payments made by scanning our UPI QR code are refunded by UPI to the account they came from."]
                        if upi_qr_on(s)
                        else []
                    ),
                    "Refunds are started the day the cancellation is accepted and usually reach you in 5–7 working days, "
                    "depending on your bank.",
                    "Orders paid in cash or by UPI on delivery are refunded by bank transfer or UPI to the details you "
                    "share with us.",
                ]
            )
        ),
        "terms": lambda: (
            "<p>This website is run by Raga Boutique, Tiruchengode, Tamil Nadu. By placing an order you agree to these "
            'terms, along with our <a href="/policies/shipping">shipping</a>, '
            '<a href="/policies/returns">cancellation and refund</a> and <a href="/policies/privacy">privacy</a> '
            "policies.</p><h2>Products</h2><p>We photograph every piece in daylight to show its true colour, but screens "
            "differ, and handwoven fabric can show small variations in weave and colour. These are part of a handmade "
            "piece, not defects.</p><h2>Prices and payment</h2><p>Prices are in Indian rupees and include applicable "
            f"taxes; delivery charges are shown at checkout. You can pay {e('; '.join(payment_methods(s)))}.</p>"
            "<h2>Orders</h2><p>An order is confirmed once we accept it; we let you know by WhatsApp and email. We may "
            "decline or cancel an order, with a full refund of anything paid, if a piece is unavailable, a price was "
            "listed in error, or the order looks fraudulent.</p><h2>Your account</h2><p>You sign in with a one-time code "
            "sent to your mobile number. Keep your phone secure; orders placed from your account are treated as yours."
            "</p><h2>Content</h2><p>Photographs, text and the Raga name and logo belong to Raga Boutique and may not be "
            "reused without permission.</p><h2>Liability and law</h2><p>Our liability for any order is limited to the "
            "amount paid for it. These terms are governed by the laws of India, and any dispute is subject to the courts "
            "of Namakkal district, Tamil Nadu.</p>"
        ),
        "privacy": lambda: (
            "<p>Raga Boutique collects only what it needs to take and deliver your orders.</p><h2>What we collect</h2>"
            + _ul(
                [
                    "Your mobile number, to sign you in with a one-time code.",
                    "Your name, email and delivery address, to deliver orders and send order updates.",
                    "Your orders and reviews, so you can see them under My orders.",
                ]
            )
            + "<h2>Payments</h2>"
            + (
                "<p>Online payments are handled by Razorpay. Your card, UPI and bank details go to Razorpay directly; we "
                "never see or store them.</p>"
                if online_on()
                else f"<p>You pay {e(', or '.join(payment_methods(s)))}. We never see or store your card or bank "
                "details; if you pay by UPI, we only keep the UPI reference number to match your payment.</p>"
            )
            + "<h2>Who we share it with</h2><p>Only the services needed to run your order: the courier (name, phone, "
            "address), and the services that send our SMS, WhatsApp and email messages. We don't sell or rent your "
            "details, and we don't send marketing messages without your consent.</p><h2>Cookies and storage</h2>"
            "<p>We use one cookie to keep you signed in. Your bag and wishlist are saved in your own browser. We don't use "
            "advertising trackers.</p><h2>Your choices</h2><p>You can update your name, email and addresses under My "
            "account. To have your account and details deleted, contact us; order records we must keep for tax purposes "
            "are kept for the period the law requires.</p>"
        ),
        "contact": lambda: (
            "<p>Questions about a piece, an order or a refund? Message us, call, or visit the showroom. Want to see a "
            "drape or the true colour first? Book a video call and we'll walk you through the pieces.</p>"
            f"<p><strong>Raga Boutique</strong></p>{contact(s)}"
        ),
    }[topic]()
