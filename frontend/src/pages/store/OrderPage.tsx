import { Link, useParams, useSearchParams } from "react-router"

import { OrderTimeline } from "@/components/common/OrderTimeline"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageLoader } from "@/components/common/PageLoader"
import { useMe, useMyOrder, useSettings } from "@/hooks/queries"
import { useTitle } from "@/hooks/useTitle"
import { fmtDate, fmtPhone, inr, waLink } from "@/lib/format"
import { LoginPrompt } from "@/pages/store/LoginPrompt"

export default function OrderPage() {
  const { orderNo = "" } = useParams()
  const [params] = useSearchParams()
  const { data: me, isLoading: meLoading } = useMe()
  const { data: o, isLoading, isError } = useMyOrder(orderNo, !!me)
  const { data: settings } = useSettings()
  useTitle(`Order ${orderNo}`)

  if (meLoading) return <PageLoader />
  if (!me) return <LoginPrompt title="Your order" text="Log in to see this order." />

  return (
    <section className="container-x pt-5 md:pt-6">
      <Link to="/account" className="mb-5 inline-block text-sm font-medium text-rust hover:underline">← My orders</Link>
      {isLoading ? <Skeleton className="h-64 rounded-2xl" /> : isError || !o ? <p className="font-heading text-xl italic text-rust">Order not found.</p> : (
        <>
          {params.get("new") && (
            <div className="mb-6 rounded-2xl bg-emerald-50 px-5 py-4 text-emerald-900">
              <p className="font-semibold">Thank you! Your order is placed.</p>
              <p className="mt-1 text-sm">Follow it here or under <Link to="/account" className="underline">My orders</Link>. We'll call {fmtPhone(o.phone)} before delivery.
                {settings?.contact_whatsapp && <> Questions? <a className="underline" href={waLink(settings.contact_whatsapp, `Hi, about my order ${o.order_no}`)} target="_blank" rel="noopener">WhatsApp us</a>.</>}</p>
            </div>
          )}
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
              <p className="text-sm leading-relaxed text-muted-foreground">{o.address.name} · {fmtPhone(o.address.phone)}<br />{o.address.line1}{o.address.line2 && `, ${o.address.line2}`}<br />{o.address.city}, {o.address.state} {o.address.pincode}</p>
              <h3 className="mb-2 mt-6 text-[22px]">Payment</h3>
              <p className="text-sm">{o.payment_method === "cod" ? "Cash / UPI on delivery" : o.payment_method} · {o.payment_status === "paid" ? "Paid" : "Pending"}</p>
            </aside>
          </div>
        </>
      )}
    </section>
  )
}
