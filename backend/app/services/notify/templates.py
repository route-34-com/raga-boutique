"""Email subject and HTML around the message text, in the store's cream and cocoa."""

from html import escape

from app.services.notify.messages import inr

SUBJECTS = {
    "accepted": "Your Raga order {no} is confirmed",
    "shipped": "Your Raga order {no} has shipped",
    "new_order": "New order {no}",
}


def subject(kind: str, order) -> str:
    return SUBJECTS[kind].format(no=order.order_no)


def html(text: str, order, link: str = "") -> str:
    rows = "".join(
        f'<tr><td style="padding:6px 0">{escape(i.name)}{f" ({escape(i.size)})" if i.size else ""} × {i.qty}</td>'
        f'<td style="padding:6px 0;text-align:right">{inr(i.price * i.qty)}</td></tr>' for i in order.items)
    button = (f'<p><a href="{escape(link)}" style="display:inline-block;background:#3d1d0f;color:#f6efe6;padding:12px 22px;'
              f'border-radius:999px;text-decoration:none">Track your parcel</a></p>') if link else ""
    return f"""<div style="background:#f6efe6;padding:32px 16px;font-family:Georgia,serif;color:#3d1d0f">
<div style="max-width:520px;margin:0 auto;background:#fffaf3;border-radius:16px;padding:28px">
<p style="font-size:22px;margin:0 0 18px">Raga</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">{escape(text)}</p>{button}
<table style="width:100%;font-family:Arial,sans-serif;font-size:14px;border-top:1px solid #ece1d1;margin-top:18px">{rows}
<tr><td style="padding:10px 0;border-top:1px solid #ece1d1"><b>Total</b></td>
<td style="padding:10px 0;border-top:1px solid #ece1d1;text-align:right"><b>{inr(order.total)}</b></td></tr></table>
</div></div>"""
