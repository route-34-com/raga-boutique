import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ApiError, api, post } from "@/lib/api"
import { STATUS_LABEL, fmtDate, fmtPhone, inr } from "@/lib/format"
import type { OrderDetail, OrderStatus } from "@/lib/types"

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { placed: "confirmed", confirmed: "packed", packed: "shipped", shipped: "delivered" }
export const NEXT_LABEL: Partial<Record<OrderStatus, string>> = { confirmed: "Confirm order", packed: "Mark packed", shipped: "Mark shipped", delivered: "Mark delivered" }
export const nextStatus = (s: OrderStatus) => NEXT[s]

export function useAdvanceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; status: OrderStatus; note?: string; courier?: string; tracking_id?: string }) =>
      post<OrderDetail>(`/api/admin/orders/${id}/status`, body),
    onSuccess: (o) => {
      qc.setQueryData(["admin", "order", o.id], o)
      qc.invalidateQueries({ queryKey: ["admin"] })
      toast.success(`${o.order_no}: ${STATUS_LABEL[o.status]}`)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't update."),
  })
}

export function OrderSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: o } = useQuery({ queryKey: ["admin", "order", id], queryFn: () => api<OrderDetail>(`/api/admin/orders/${id}`), enabled: id !== null })
  const advance = useAdvanceOrder()
  const [note, setNote] = useState("")
  const [courier, setCourier] = useState("")
  const [tracking, setTracking] = useState("")
  const next = o && NEXT[o.status]
  const mobile = o?.address.phone ?? ""
  const msg = o ? encodeURIComponent(`Hi ${o.customer_name.split(" ")[0]}, this is Raga Boutique about your order ${o.order_no}.`) : ""
  const addressText = o ? `${o.address.name}\n${o.address.phone}\n${o.address.line1}${o.address.line2 ? ", " + o.address.line2 : ""}\n${o.address.city}, ${o.address.state} ${o.address.pincode}` : ""

  function go(status: OrderStatus) {
    if (!o) return
    const warning = o.status === "shipped"
      ? "This order has already shipped. Cancel it only if the parcel is coming back to you (RTO). Stock will be put back."
      : "Cancel this order? Stock will be put back."
    if (status === "cancelled" && !confirm(warning)) return
    advance.mutate({ id: o.id, status, note, courier, tracking_id: tracking }, { onSuccess: () => setNote("") })
  }

  return (
    <Sheet open={id !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto bg-card p-0 sm:max-w-[560px]">
        {!o ? <SheetTitle className="p-6">Loading…</SheetTitle> : <>
          <SheetHeader className="border-b px-6 py-5">
            <p className="eyebrow">Order</p>
            <div className="flex items-center gap-3 pr-8"><SheetTitle className="font-heading text-[26px] font-normal text-cocoa">{o.order_no}</SheetTitle><StatusBadge status={o.status} /></div>
            <SheetDescription>{fmtDate(o.created_at, true)}</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-6 py-5 text-sm">
            {next && (
              <div className="space-y-3 rounded-xl border border-[#f0d9b2] bg-[#fdf3e2] p-4">
                {next === "shipped" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5"><Label>Courier</Label><Input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. Delhivery" className="bg-white" /></div>
                    <div className="grid gap-1.5"><Label>Tracking no.</Label><Input value={tracking} onChange={(e) => setTracking(e.target.value)} className="bg-white" /></div>
                  </div>
                )}
                <div className="grid gap-1.5"><Label>Note for the timeline (optional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="bg-white" /></div>
                <div className="flex flex-wrap gap-2.5">
                  <Button className="h-10 px-4" disabled={advance.isPending} onClick={() => go(next)}>{NEXT_LABEL[next]}</Button>
                  <Button variant="destructive" className="h-10 px-4" disabled={advance.isPending} onClick={() => go("cancelled")}>Cancel order</Button>
                </div>
              </div>
            )}
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Items</h4>
              {o.items.map((it, i) => (
                <div key={i} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 border-b py-2.5">
                  <img src={it.image} alt="" className="h-[60px] w-12 rounded-lg object-cover" />
                  <div><strong className="block">{it.name}</strong><span className="text-xs text-muted-foreground">{it.size && `Size ${it.size} · `}Qty {it.qty} × {inr(it.price)}</span></div>
                  <span>{inr(it.price * it.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2"><span>Subtotal</span><span>{inr(o.subtotal)}</span></div>
              <div className="flex justify-between pt-1"><span>Shipping</span><span>{o.shipping ? inr(o.shipping) : "Free"}</span></div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base"><span>Total</span><strong>{inr(o.total)}</strong></div>
              <div className="flex justify-between pt-1"><span>Payment</span><span>{o.payment_method === "cod" ? "Cash on delivery" : o.payment_method} · {o.payment_status === "paid" ? "Paid" : "Pending"}</span></div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Customer</h4>
              <p>{o.customer_name}{o.email && <> · <a className="underline" href={`mailto:${o.email}`}>{o.email}</a></>}<br />Login phone {fmtPhone(o.phone)}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm"><a href={`tel:+91${mobile}`}>Call</a></Button>
                <Button asChild variant="outline" size="sm"><a target="_blank" rel="noopener" href={`https://wa.me/91${mobile}?text=${msg}`}>WhatsApp</a></Button>
                <Button variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(addressText).catch(() => {}); toast("Address copied.") }}>Copy address</Button>
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Ship to</h4>
              <p className="whitespace-pre-line leading-relaxed">{addressText}</p>
              {o.tracking_id && <p className="mt-2">Courier: <strong>{o.courier}</strong> · {o.tracking_id}</p>}
            </div>
            {o.note && <div><h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Customer note</h4><p>{o.note}</p></div>}
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">History</h4>
              <ol className="list-decimal space-y-1.5 pl-5">
                {o.events.map((e, i) => <li key={i}><strong>{STATUS_LABEL[e.status]}</strong> <span className="text-xs text-muted-foreground">{fmtDate(e.created_at, true)}</span>{e.note && <><br /><span className="text-xs">{e.note}</span></>}</li>)}
              </ol>
            </div>
          </div>
        </>}
      </SheetContent>
    </Sheet>
  )
}
