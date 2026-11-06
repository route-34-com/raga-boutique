import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Copy, Mail, MapPin, MessageCircle, Package, PackageCheck, Phone, Truck, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { OrderTimeline } from "@/components/common/OrderTimeline"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ApiError, api, post } from "@/lib/api"
import { STATUS_LABEL, fmtDate, fmtPhone, inr } from "@/lib/format"
import type { AdminOrderDetail, Courier, Notice, OrderStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import { Photo } from "@/components/common/Photo"
import { confirmAction } from "@/components/common/Confirm"

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { placed: "confirmed", confirmed: "packed", packed: "shipped", shipped: "delivered" }
export const NEXT_LABEL: Partial<Record<OrderStatus, string>> = { confirmed: "Accept order", packed: "Mark packed", shipped: "Mark shipped", delivered: "Mark delivered" }
export const nextStatus = (s: OrderStatus) => NEXT[s]
const NEXT_ICONS = { confirmed: Check, packed: Package, shipped: Truck, delivered: PackageCheck }
function NextIcon({ status }: { status: OrderStatus }) {
  const Icon = NEXT_ICONS[status as keyof typeof NEXT_ICONS] ?? Check
  return <Icon />
}

export function useAdvanceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; status: OrderStatus; note?: string; courier?: string; tracking_id?: string }) =>
      post<AdminOrderDetail>(`/api/admin/orders/${id}/status`, body),
    onSuccess: (o) => {
      qc.setQueryData(["admin", "order", o.id], o)
      qc.invalidateQueries({ queryKey: ["admin"] })
      const kind = ({ confirmed: "accepted", shipped: "shipped", delivered: "delivered" } as const)[o.status as "confirmed" | "shipped" | "delivered"] ?? null
      const wa = kind && o.notifications.find((n) => n.kind === kind && n.channel === "whatsapp" && n.status === "tap")
      // Browsers block pop-ups opened after a network wait, so the owner taps the toast to open WhatsApp.
      const mail = kind && o.notifications.find((n) => n.kind === kind && n.channel === "email")
      const mailNote = mail?.status === "sent" ? "Email sent" : mail?.status === "failed" ? "Email failed" : mail?.status === "skipped" ? "No email on this order" : "Email not set up yet"
      if (wa) toast.success(`${o.order_no}: ${STATUS_LABEL[o.status]}. ${mailNote} — now send the WhatsApp message.`,
        { duration: 20_000, action: { label: "Open WhatsApp", onClick: () => window.open(wa.detail, "_blank", "noopener") } })
      else toast.success(`${o.order_no}: ${STATUS_LABEL[o.status]}`)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't update."),
  })
}

export function OrderSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: o } = useQuery({ queryKey: ["admin", "order", id], queryFn: () => api<AdminOrderDetail>(`/api/admin/orders/${id}`), enabled: id !== null })
  const { data: couriers = [] } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api<{ couriers: Courier[] }>("/api/admin/settings"),
    select: (s) => s.couriers })
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
    const run = () => advance.mutate({ id: o.id, status, note, courier, tracking_id: tracking }, { onSuccess: () => setNote("") })
    if (status !== "cancelled") return run()
    void confirmAction({ title: `Cancel ${o.order_no}?`, body: warning, action: "Cancel order", cancel: "Keep order" }).then((ok) => ok && run())
  }

  const heading = "mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"
  const card = "rounded-2xl border bg-white/70 p-5"
  const track = couriers.find((c) => c.name.trim().toLowerCase() === o?.courier.trim().toLowerCase())?.track_url ?? ""
  const trackUrl = o?.tracking_id && track.includes("{id}") ? track.replace("{id}", encodeURIComponent(o.tracking_id)) : ""
  return (
    <Dialog open={id !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-5xl">
        {!o ? <><DialogTitle className="sr-only">Loading order</DialogTitle><DialogDescription className="sr-only">Loading the order</DialogDescription><div className="grid min-h-64 place-items-center"><Spinner className="size-6 text-rust" /></div></> : <>
          <DialogHeader className="gap-1 border-b px-6 py-5">
            <p className="eyebrow">Order</p>
            <div className="flex flex-wrap items-center gap-3 pr-8">
              <DialogTitle className="font-heading text-[26px] font-normal leading-tight text-cocoa">{o.order_no}</DialogTitle>
              <StatusBadge status={o.status} />
              <span className="font-semibold">{inr(o.total)}</span>
            </div>
            <DialogDescription>{fmtDate(o.created_at, true)} · {o.customer_name}, {o.address.city}</DialogDescription>
            {o.status !== "cancelled" && <div className="mt-4 pr-8"><OrderTimeline order={o} /></div>}
          </DialogHeader>
          <div className="grid flex-1 items-start gap-4 overflow-y-auto bg-[#f7f1e8] p-5 text-sm lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-4 lg:sticky lg:top-0">
            {next && (
              <div className="space-y-3 rounded-xl border border-[#f0d9b2] bg-[#fdf3e2] p-4">
                {next === "shipped" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5"><Label>Courier</Label><Input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. Delhivery" list="couriers" className="bg-white" />
                      <datalist id="couriers">{couriers.map((c) => <option key={c.name} value={c.name} />)}</datalist></div>
                    <div className="grid gap-1.5"><Label>Tracking no.</Label><Input value={tracking} onChange={(e) => setTracking(e.target.value)} className="bg-white" /></div>
                  </div>
                )}
                <div className="grid gap-1.5"><Label>Note for the timeline (optional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="bg-white" /></div>
                <div className="flex flex-wrap gap-2.5">
                  <Button className="h-11 flex-1 px-4 sm:h-10 sm:flex-none" disabled={advance.isPending} onClick={() => go(next)}>{advance.isPending && advance.variables?.status === next ? <Spinner /> : <NextIcon status={next} />}{NEXT_LABEL[next]}</Button>
                  <Button variant="destructive" className="h-11 flex-1 px-4 sm:h-10 sm:flex-none" disabled={advance.isPending} onClick={() => go("cancelled")}>{advance.isPending && advance.variables?.status === "cancelled" ? <Spinner /> : <X />}Cancel order</Button>
                </div>
              </div>
            )}
            <div className={card}>
              <h4 className={heading}>Items · {o.items.reduce((n, it) => n + it.qty, 0)}</h4>
              {o.items.map((it, i) => (
                <div key={i} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 border-b py-2.5">
                  <Photo src={it.image} alt="" className="h-20 w-16 rounded-lg object-cover" />
                  <div><strong className="block">{it.name}</strong><span className="text-xs text-muted-foreground">{it.size && `Size ${it.size} · `}Qty {it.qty} × {inr(it.price)}</span></div>
                  <span>{inr(it.price * it.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2"><span>Subtotal</span><span>{inr(o.subtotal)}</span></div>
              <div className="flex justify-between pt-1"><span>Shipping</span><span>{o.shipping ? inr(o.shipping) : "Free"}</span></div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base"><span>Total</span><strong>{inr(o.total)}</strong></div>
              <div className="flex justify-between pt-1"><span>Payment</span><span>{o.payment_method === "cod" ? "Cash on delivery" : o.payment_method} · {o.payment_status === "paid" ? "Paid" : "Pending"}</span></div>
            </div>
          </div>
          <div className="space-y-4">
            <section className={card}>
              <h4 className={heading}>Customer</h4>
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sand font-heading text-lg text-cocoa">{initials(o.customer_name)}</span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-cocoa">{o.customer_name}</p>
                  <p className="text-xs text-muted-foreground">Logged in as {fmtPhone(o.phone)}</p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                <li className="flex items-center gap-2.5"><Phone className="size-4 text-muted-foreground" /><a href={`tel:+91${mobile}`} className="link-quiet">{fmtPhone(mobile)}</a></li>
                {o.email && <li className="flex items-center gap-2.5"><Mail className="size-4 text-muted-foreground" /><a href={`mailto:${o.email}`} className="truncate link-quiet">{o.email}</a></li>}
              </ul>
              <div className="mt-3.5 grid grid-cols-2 gap-2">
                <Button asChild variant="outline" className="h-9"><a href={`tel:+91${mobile}`}><Phone />Call</a></Button>
                <Button asChild variant="outline" className="h-9"><a target="_blank" rel="noopener" href={`https://wa.me/91${mobile}?text=${msg}`}><MessageCircle />WhatsApp</a></Button>
              </div>
            </section>

            <section className={card}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className={cn(heading, "mb-0")}>Ship to</h4>
                <Button variant="ghost" size="sm" className="-mr-2 text-rust" onClick={async () => { await navigator.clipboard.writeText(addressText).catch(() => {}); toast("Address copied.") }}><Copy />Copy</Button>
              </div>
              <div className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="leading-relaxed"><strong className="text-cocoa">{o.address.name}</strong><br />{o.address.line1}{o.address.line2 && <>, {o.address.line2}</>}<br />{o.address.city}, {o.address.state} <span className="font-semibold">{o.address.pincode}</span></p>
              </div>
              {o.tracking_id && (
                <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-[#f7f1e8] px-3 py-2">
                  <Truck className="size-4 shrink-0 text-muted-foreground" />
                  <span><strong>{o.courier}</strong> · {trackUrl ? <a href={trackUrl} target="_blank" rel="noopener" className="font-mono text-rust link-quiet">{o.tracking_id}</a> : <span className="font-mono">{o.tracking_id}</span>}</span>
                </div>
              )}
            </section>

            {o.note && (
              <section className={cn(card, "border-[#f0d9b2] bg-[#fdf3e2]")}>
                <h4 className={heading}>Customer note</h4>
                <p className="italic">“{o.note}”</p>
              </section>
            )}

            {o.notifications.length > 0 && (
              <section className={card}>
                <h4 className={heading}>Messages</h4>
                <ul className="divide-y">{o.notifications.map((n, i) => <NoticeRow key={i} n={n} />)}</ul>
              </section>
            )}

            {(o.status === "cancelled" || o.events.some((e) => e.note)) && <section className={card}>
              <h4 className={heading}>History</h4>
              <ol className="mt-1">
                {o.events.map((e, i) => (
                  <li key={i} className="relative pb-4 pl-6 last:pb-0">
                    {i < o.events.length - 1 && <span className="absolute bottom-0 left-[5px] top-3 w-px bg-border" />}
                    <span className={cn("absolute left-0 top-1 size-[11px] rounded-full border-2 bg-card",
                      e.status === "cancelled" ? "border-destructive" : i === o.events.length - 1 ? "border-marigold bg-marigold" : "border-marigold")} />
                    <p className="font-semibold text-cocoa">{STATUS_LABEL[e.status]}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(e.created_at, true)}</p>
                    {e.note && <p className="mt-0.5 text-xs">{e.note}</p>}
                  </li>
                ))}
              </ol>
            </section>}
          </div>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  )
}

const KIND_LABEL: Record<Notice["kind"], string> = { accepted: "Order accepted", shipped: "Shipped with tracking", delivered: "Delivered, review request", new_order: "New-order alert to shop" }
const RESULT: Record<Notice["status"], string> = { sending: "Sending…", sent: "Sent", tap: "Ready to send", logged: "Not set up", skipped: "Skipped", failed: "Failed" }

const TONE: Record<Notice["status"], string> = {
  sending: "bg-muted text-muted-foreground", sent: "bg-emerald-100 text-emerald-800", tap: "bg-amber-100 text-amber-800",
  logged: "bg-muted text-muted-foreground", skipped: "bg-muted text-muted-foreground", failed: "bg-red-100 text-red-800",
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?"
}

function NoticeRow({ n }: { n: Notice }) {
  const Icon = n.channel === "whatsapp" ? MessageCircle : Mail
  return (
    <li className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{KIND_LABEL[n.kind]}</p>
        {n.status !== "tap" && n.detail && <p className={cn("break-words text-xs", n.status === "failed" ? "text-destructive" : "text-muted-foreground")}>{n.detail}</p>}
        {n.status === "tap" && <a href={n.detail} target="_blank" rel="noopener" className="text-xs font-semibold text-rust link-quiet">Open WhatsApp to send</a>}
      </div>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", TONE[n.status])}>{RESULT[n.status]}</span>
    </li>
  )
}
