import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, Copy, Smartphone } from "lucide-react"
import QRCode from "qrcode"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { keys } from "@/hooks/queries"
import { ApiError, post } from "@/lib/api"
import { inr } from "@/lib/format"
import type { OrderDetail } from "@/lib/types"

export function upiLink(upiId: string, payee: string, amount: number, orderNo: string) {
  const q = new URLSearchParams({ pa: upiId, pn: payee, am: amount.toFixed(2), cu: "INR", tn: `Raga order ${orderNo}` })
  return `upi://pay?${q.toString().replace(/\+/g, "%20")}`
}

export function UpiPay({ order, upiId, payee }: { order: OrderDetail; upiId: string; payee: string }) {
  const qc = useQueryClient()
  const [qr, setQr] = useState("")
  const [ref, setRef] = useState("")
  const [copied, setCopied] = useState(false)
  const link = upiLink(upiId, payee, order.total, order.order_no)

  useEffect(() => {
    QRCode.toDataURL(link, { width: 480, margin: 1, errorCorrectionLevel: "M", color: { dark: "#2a160c", light: "#ffffff" } }).then(setQr)
  }, [link])

  const paid = useMutation({
    mutationFn: () => post<OrderDetail>(`/api/me/orders/${order.order_no}/upi-paid`, { ref }),
    onSuccess: (o) => qc.setQueryData(keys.myOrder(order.order_no), o),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't save that. Please try again."),
  })

  const copy = async () => {
    await navigator.clipboard?.writeText(upiId).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  if (order.payment_status === "claimed") return (
    <div className="mb-8 rounded-2xl border bg-paper px-5 py-4">
      <p className="font-semibold">Payment sent · {inr(order.total)} by UPI</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {order.payment_ref ? <>Reference <strong className="text-foreground">{order.payment_ref}</strong>. </> : null}
        We'll check it with our bank and confirm your order shortly.
      </p>
    </div>
  )

  return (
    <section aria-labelledby="upi-title" className="mb-9 grid items-center gap-6 rounded-2xl border bg-paper p-5 md:grid-cols-[240px_1fr] md:gap-9 md:p-7">
      <div className="mx-auto w-full max-w-[240px] rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
        {qr ? <img src={qr} alt={`UPI QR code to pay ${inr(order.total)} to ${payee}`} className="aspect-square w-full" /> : <div className="aspect-square w-full animate-pulse rounded-lg bg-sand/50" />}
      </div>
      <div>
        <p className="eyebrow">Pay now with UPI</p>
        <h2 id="upi-title" className="mt-1.5 text-[clamp(30px,3.4vw,42px)] leading-none">{inr(order.total)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Scan the code with GPay, PhonePe, Paytm or any UPI app. The amount and order number are filled in for you.</p>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border bg-background px-4 py-2.5 text-sm">
          <span><span className="block text-xs text-muted-foreground">Paying {payee}</span><strong className="font-semibold">{upiId}</strong></span>
          <Button type="button" variant="ghost" size="sm" onClick={copy} aria-label="Copy UPI ID">{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}</Button>
        </div>

        <Button asChild className="mt-3 h-11 w-full rounded-full md:hidden">
          <a href={link}><Smartphone />Pay with a UPI app</a>
        </Button>

        <form className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={(e) => { e.preventDefault(); paid.mutate() }}>
          <label className="sr-only" htmlFor="upi-ref">UPI reference number (optional)</label>
          <Input id="upi-ref" inputMode="numeric" maxLength={40} placeholder="UPI reference no. (optional)" value={ref}
            onChange={(e) => setRef(e.target.value.replace(/[^A-Za-z0-9]/g, ""))} className="h-11 bg-background" />
          <Button className="h-11 rounded-full px-6" disabled={paid.isPending}>{paid.isPending ? <Spinner /> : "I've paid"}</Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">You'll find the reference number in your UPI app after paying. We confirm every payment before packing.</p>
      </div>
    </section>
  )
}
