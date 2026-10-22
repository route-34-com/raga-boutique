import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"

import { OrderTimeline } from "@/components/common/OrderTimeline"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { keys, useMe, useMyOrder } from "@/hooks/queries"
import { ApiError, post } from "@/lib/api"
import { fmtDate, inr } from "@/lib/format"
import type { OrderDetail } from "@/lib/types"
import { LoginPrompt } from "@/pages/store/LoginPrompt"

export default function OrderPage() {
  const { orderNo = "" } = useParams()
  const [params] = useSearchParams()
  const { data: me, isLoading: meLoading } = useMe()
  const { data: o, isLoading, isError } = useMyOrder(orderNo, !!me)
  const qc = useQueryClient()

  const cancel = useMutation({
    mutationFn: () => post<OrderDetail>(`/api/me/orders/${orderNo}/cancel`),
    onSuccess: (d) => {
      qc.setQueryData(keys.myOrder(orderNo), d)
      qc.invalidateQueries({ queryKey: keys.myOrders })
      qc.invalidateQueries({ queryKey: ["products"] })
      toast("Order cancelled.")
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't cancel."),
  })

  if (meLoading) return null
  if (!me) return <LoginPrompt title="Your order" text="Log in to see this order." />

  return (
    <section className="container-x pt-8 md:pt-16">
      <p className="eyebrow mb-6"><Link to="/" className="hover:underline">Home</Link> / <Link to="/account" className="hover:underline">My orders</Link></p>
      {isLoading ? <Skeleton className="h-64 rounded-2xl" /> : isError || !o ? <p className="font-heading text-xl italic text-rust">Order not found.</p> : (
        <>
          {params.get("new") && <div className="mb-6 rounded-2xl bg-emerald-50 px-5 py-4 font-medium text-emerald-900">Thank you! Your order is placed. We'll message you on {o.phone} as it moves.</div>}
          <div className="mb-7 flex items-start justify-between gap-4">
            <div><p className="eyebrow">Order</p><h1 className="my-1.5 text-[clamp(34px,4vw,52px)]">{o.order_no}</h1><p className="text-muted-foreground">Placed {fmtDate(o.created_at, true)}</p></div>
            <StatusBadge status={o.status} />
          </div>
          {o.status === "cancelled"
            ? <p className="mb-8 rounded-2xl border bg-paper px-5 py-4">This order was cancelled. Any stock was released.</p>
            : <div className="mb-9"><OrderTimeline order={o} /></div>}
          {o.tracking_id && <p className="mb-8 rounded-2xl border bg-paper px-5 py-4">Shipped with {o.courier} · Tracking no. <strong>{o.tracking_id}</strong></p>}
          <div className="grid items-start gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
            <div>
              {o.items.map((it, i) => (
                <div key={i} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b py-2.5 text-sm">
                  <img src={it.image} alt="" className="aspect-[4/5] w-14 rounded-lg object-cover" />
                  <div><strong className="block">{it.name}</strong><span className="text-xs text-muted-foreground">Raag {it.raga}{it.size && ` · ${it.size}`} · Qty {it.qty}</span></div>
                  <span>{inr(it.price * it.qty)}</span>
                </div>
              ))}
              <div className="mt-2.5 flex justify-between py-2"><span>Subtotal</span><span>{inr(o.subtotal)}</span></div>
              <div className="flex justify-between py-2"><span>Shipping</span><span>{o.shipping ? inr(o.shipping) : "Free"}</span></div>
              <div className="mt-1.5 flex justify-between border-t pt-3.5 text-lg"><span>Total</span><strong>{inr(o.total)}</strong></div>
            </div>
            <aside className="rounded-2xl bg-paper p-6">
              <h3 className="mb-2 text-[22px]">Delivering to</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{o.address.name} · {o.address.phone}<br />{o.address.line1}{o.address.line2 && `, ${o.address.line2}`}<br />{o.address.city}, {o.address.state} {o.address.pincode}</p>
              <h3 className="mb-2 mt-6 text-[22px]">Payment</h3>
              <p className="text-sm">{o.payment_method === "cod" ? "Cash / UPI on delivery" : o.payment_method} · {o.payment_status === "paid" ? "Paid" : "Pending"}</p>
              {["placed", "confirmed"].includes(o.status) && (
                <Button variant="outline" className="mt-5 h-11 w-full rounded-full border-cocoa bg-transparent" disabled={cancel.isPending}
                  onClick={() => confirm("Cancel this order?") && cancel.mutate()}>Cancel order</Button>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  )
}
