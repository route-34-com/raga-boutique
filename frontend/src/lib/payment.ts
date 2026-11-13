type Payable = { payment_method: string; payment_status: string; payment_ref?: string; status?: string }

const METHOD = {
  store: { cod: "Cash / UPI on delivery", upi: "UPI", online: "Paid online" },
  admin: { cod: "Cash on delivery", upi: "UPI (shop QR)", online: "Online (Razorpay)" },
} as const

export function paymentLabel(o: Payable, side: "store" | "admin") {
  const method = METHOD[side][o.payment_method as keyof (typeof METHOD)["store"]] ?? o.payment_method
  const ref = o.payment_ref ? ` · ${o.payment_ref}` : ""
  if (o.payment_status === "refunded") return `${side === "store" ? "Online" : method} · Refunded${side === "admin" ? ref : ""}`
  if (o.payment_status === "paid") return o.payment_method === "online" ? `${side === "store" ? "Paid online" : `${method} · Paid`}${side === "admin" ? ref : ""}` : `${method} · Paid`
  if (o.payment_status === "claimed") return side === "admin" ? `${method} · Customer says paid${o.payment_ref ? ` · ref ${o.payment_ref}` : ""}` : `${method} · Checking payment`
  if (o.payment_method === "online") return o.status === "cancelled" ? "Online · Not paid" : side === "store" ? "Online · Payment pending" : `${method} · Awaiting payment`
  return `${method} · ${o.payment_method === "upi" ? "Not paid yet" : "Pending"}`
}

export const paymentShort = (o: Payable) =>
  o.payment_status === "refunded" ? "Refunded"
    : o.status === "cancelled" ? "Not due"
    : o.payment_status === "paid" ? "Paid"
    : o.payment_status === "claimed" ? "To check"
    : o.payment_method === "online" ? "Awaiting payment" : "Pending"
