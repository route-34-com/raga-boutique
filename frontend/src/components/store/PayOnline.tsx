import { useQueryClient } from "@tanstack/react-query"
import { CreditCard, Landmark, Lock, ShieldCheck, Smartphone, Wallet } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { keys } from "@/hooks/queries"
import { ApiError, post } from "@/lib/api"
import { inr } from "@/lib/format"
import type { OrderDetail } from "@/lib/types"
import { cn } from "@/lib/utils"

export type PayOptions = {
  provider: "razorpay" | "demo"
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description: string
  prefill: { name: string; email: string; contact: string }
}

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
type RazorpayCtor = new (o: Record<string, unknown>) => { open: () => void; on: (e: string, f: () => void) => void }
declare global { interface Window { Razorpay?: RazorpayCtor } }

let script: Promise<void> | null = null
function loadRazorpay() {
  script ??= new Promise<void>((res, rej) => {
    const s = document.createElement("script")
    s.src = "https://checkout.razorpay.com/v1/checkout.js"
    s.onload = () => res()
    s.onerror = () => { script = null; rej(new Error("Razorpay didn't load")) }
    document.body.appendChild(s)
  })
  return script
}

const METHODS = [
  { id: "upi", label: "UPI", note: "GPay, PhonePe, Paytm, BHIM", icon: Smartphone },
  { id: "card", label: "Card", note: "Visa, Mastercard, RuPay", icon: CreditCard },
  { id: "netbanking", label: "Netbanking", note: "All major banks", icon: Landmark },
  { id: "wallet", label: "Wallet", note: "Paytm, Amazon Pay and more", icon: Wallet },
]

/** Opens the payment window for an order paid online; resolves once the server has marked it paid. */
export function usePayOnline() {
  const qc = useQueryClient()
  const [demo, setDemo] = useState<{ orderNo: string; opts: PayOptions; done: (paid: boolean) => void } | null>(null)
  const [method, setMethod] = useState("upi")
  const [busy, setBusy] = useState(false)

  const settle = (orderNo: string, o: OrderDetail) => {
    qc.setQueryData(keys.myOrder(orderNo), o)
    qc.invalidateQueries({ queryKey: keys.myOrders })
  }

  const pay = (orderNo: string, opts: PayOptions) => new Promise<boolean>((resolve) => {
    if (opts.provider === "demo") { setMethod("upi"); setDemo({ orderNo, opts, done: resolve }); return }
    loadRazorpay().then(() => {
      const rzp = new window.Razorpay!({
        key: opts.key, order_id: opts.order_id, amount: opts.amount, currency: opts.currency, name: opts.name,
        description: opts.description, prefill: opts.prefill, theme: { color: "#3d1d0f" },
        handler: (r: RazorpayResponse) => post<OrderDetail>(`/api/me/orders/${orderNo}/pay/verify`, r)
          .then((o) => { settle(orderNo, o); resolve(true) })
          .catch((e) => { toast.error(e instanceof ApiError ? e.message : "We couldn't confirm the payment yet."); resolve(false) }),
        modal: { ondismiss: () => resolve(false) },
      })
      rzp.on("payment.failed", () => toast.error("The payment didn't go through. You can try again from your order."))
      rzp.open()
    }).catch(() => { toast.error("Couldn't open the payment window. Check your connection and try again."); resolve(false) })
  })

  const closeDemo = (paid: boolean) => { demo?.done(paid); setDemo(null) }
  const confirmDemo = async () => {
    if (!demo) return
    setBusy(true)
    try {
      settle(demo.orderNo, await post<OrderDetail>(`/api/me/orders/${demo.orderNo}/pay/demo`))
      closeDemo(true)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Payment failed.")
    } finally { setBusy(false) }
  }

  const dialog = (
    <Dialog open={!!demo} onOpenChange={(v) => !v && !busy && closeDemo(false)}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {demo && <>
          <DialogHeader className="gap-1 bg-cocoa px-6 py-5 text-left text-white">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="font-heading text-xl font-normal text-white">{demo.opts.name}</DialogTitle>
              <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">Test mode</span>
            </div>
            <DialogDescription className="text-white/75">{demo.opts.description} · {demo.opts.prefill.contact}</DialogDescription>
            <p className="mt-2 font-heading text-3xl">{inr(demo.opts.amount / 100)}</p>
          </DialogHeader>
          <div className="p-5">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">Pay with</p>
            <div role="radiogroup" aria-label="Payment method" className="grid gap-2">
              {METHODS.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)}
                  className={cn("flex items-center gap-3 rounded-xl border bg-white p-3 text-left text-sm transition", method === m.id ? "border-cocoa ring-1 ring-cocoa" : "hover:border-foreground/30")}>
                  <m.icon className="size-5 text-rust" aria-hidden="true" />
                  <span className="flex-1"><strong className="block font-semibold">{m.label}</strong><span className="text-xs text-muted-foreground">{m.note}</span></span>
                  <span className={cn("size-4 rounded-full border-2", method === m.id ? "border-cocoa bg-cocoa shadow-[inset_0_0_0_2px_white]" : "border-muted-foreground/40")} />
                </button>
              ))}
            </div>
            <Button className="mt-4 h-12 w-full rounded-full" disabled={busy} onClick={confirmDemo}>
              {busy ? <Spinner /> : <Lock />}Pay {inr(demo.opts.amount / 100)}
            </Button>
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Demo payment window, no money moves. On the live shop, Razorpay's secure checkout opens here.
            </p>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  )

  return { pay, dialog }
}
