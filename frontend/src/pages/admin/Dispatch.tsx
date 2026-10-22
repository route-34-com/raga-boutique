import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, MessageCircle, X } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"

import { PageHead } from "@/components/admin/AdminLayout"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, api, post } from "@/lib/api"
import { STATUS_LABEL } from "@/lib/format"
import type { AdminOrderRow, Courier, DispatchResult } from "@/lib/types"

type Row = { on: boolean; courier: string; tracking: string }

// Mirrors backend app/services/notify/messages.py, for the preview only.
function preview(o: AdminOrderRow, courier: string, tracking: string, couriers: Courier[]) {
  const c = couriers.find((x) => x.name.trim().toLowerCase() === courier.trim().toLowerCase())
  const link = c?.track_url.includes("{id}") ? c.track_url.replace("{id}", tracking || "…") : ""
  const text = `Hi ${o.customer_name.split(" ")[0] || "there"}, your Raga order ${o.order_no} is on its way with ${courier || "…"}. Tracking ID: ${tracking || "…"}.`
  return link ? `${text} Track it here: ${link}` : text
}

export default function Dispatch() {
  const qc = useQueryClient()
  const { data: orders } = useQuery({
    queryKey: ["admin", "orders", "ready"],
    queryFn: async () => {
      const [a, b] = await Promise.all(["confirmed", "packed"].map((status) => api<AdminOrderRow[]>(`/api/admin/orders?status=${status}`)))
      return [...a, ...b].sort((x, y) => x.id - y.id)
    },
  })
  const { data: couriers = [] } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api<{ couriers: Courier[] }>("/api/admin/settings"),
    select: (s) => s.couriers })
  const [batch, setBatch] = useState("")
  const [rows, setRows] = useState<Record<number, Row>>({})
  const [results, setResults] = useState<DispatchResult[] | null>(null)
  const [tapped, setTapped] = useState<Set<number>>(new Set())

  const batchCourier = batch || couriers[0]?.name || ""
  const row = (id: number): Row => rows[id] ?? { on: false, courier: "", tracking: "" }
  const set = (id: number, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...row(id), ...patch } }))
  const chosen = (orders ?? []).filter((o) => row(o.id).on)
  const courierOf = (id: number) => row(id).courier || batchCourier
  const ready = chosen.length > 0 && chosen.every((o) => row(o.id).tracking.trim() && courierOf(o.id).trim())

  const send = useMutation({
    mutationFn: () => post<DispatchResult[]>("/api/admin/orders/dispatch", {
      items: chosen.map((o) => ({ order_id: o.id, courier: courierOf(o.id).trim(), tracking_id: row(o.id).tracking.trim() })),
    }),
    onSuccess: (r) => {
      setResults(r)
      setRows({})
      qc.invalidateQueries({ queryKey: ["admin"] })
      const ok = r.filter((x) => x.ok).length
      toast.success(`${ok} of ${r.length} marked shipped. Customers are emailed automatically.`)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't send. Nothing was changed."),
  })

  return (
    <>
      <PageHead eyebrow="Orders" title="Dispatch" />
      {results && (
        <section className="mb-4 rounded-2xl border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xl">Sent</h3>
            <Button variant="outline" size="sm" onClick={() => { setResults(null); setTapped(new Set()) }}>Done</Button>
          </div>
          {results.some((r) => r.whatsapp_link) && (
            <p className="mb-3 text-sm text-muted-foreground">Open each WhatsApp message below and tap send.</p>
          )}
          <ul className="divide-y text-sm">
            {results.map((r) => (
              <li key={r.order_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="flex items-center gap-2">
                  {r.ok ? <Check className="size-4 text-green-700" /> : <X className="size-4 text-destructive" />}
                  <strong>{r.order_no}</strong>
                  {!r.ok && <span className="text-destructive">{r.error}</span>}
                </span>
                {r.whatsapp_link && (
                  <Button asChild size="sm" variant={tapped.has(r.order_id) ? "outline" : "default"}>
                    <a href={r.whatsapp_link} target="_blank" rel="noopener" onClick={() => setTapped((t) => new Set(t).add(r.order_id))}>
                      <MessageCircle className="size-4" />{tapped.has(r.order_id) ? "Opened" : "Open WhatsApp"}
                    </a>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-xl">Ready to ship</h3>
            <p className="text-sm text-muted-foreground">Accepted orders. Tick the ones going out, type each tracking ID, then send.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="batch">Courier for this batch</Label>
            <Input id="batch" list="dispatch-couriers" value={batchCourier} onChange={(e) => setBatch(e.target.value)} placeholder="e.g. DTDC" className="h-10 w-56" />
            <datalist id="dispatch-couriers">{couriers.map((c) => <option key={c.name} value={c.name} />)}</datalist>
          </div>
        </div>
        {couriers.length === 0 && (
          <p className="mb-4 rounded-xl bg-[#fdf3e2] px-4 py-3 text-sm">Add your couriers and their tracking links in <Link to="/admin/settings" className="font-semibold underline">Settings</Link> so customers get a link to track.</p>
        )}

        {!orders ? <Skeleton className="h-40" /> : orders.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No accepted orders waiting. Accept new orders from <Link to="/admin/orders?status=placed" className="underline">Orders</Link>.</p>
        ) : (
          <div className="divide-y">
            <label className="flex items-center gap-3 pb-3 text-sm font-semibold">
              <Checkbox checked={chosen.length === orders.length} onCheckedChange={(v) => setRows((r) => Object.fromEntries(orders.map((o) => [o.id, { ...(r[o.id] ?? { courier: "", tracking: "" }), on: !!v }])))} />
              Select all ({orders.length})
            </label>
            {orders.map((o) => {
              const r = row(o.id)
              return (
                <div key={o.id} className="grid grid-cols-[auto_1fr] items-center gap-2.5 py-3 text-sm md:grid-cols-[auto_1fr_180px_220px]">
                  <Checkbox checked={r.on} onCheckedChange={(v) => set(o.id, { on: !!v })} aria-label={`Select ${o.order_no}`} />
                  <div>
                    <strong>{o.order_no}</strong> · {o.customer_name} · {o.address.city}
                    <span className="block text-xs text-muted-foreground">{STATUS_LABEL[o.status]} · {o.item_count} item(s)</span>
                  </div>
                  <Input aria-label={`Courier for ${o.order_no}`} list="dispatch-couriers" value={r.courier || batchCourier}
                    onChange={(e) => set(o.id, { courier: e.target.value, on: true })} className="h-9 max-md:col-start-2" />
                  <Input aria-label={`Tracking ID for ${o.order_no}`} value={r.tracking} placeholder="Tracking ID"
                    onChange={(e) => set(o.id, { tracking: e.target.value, on: true })} className="h-9 max-md:col-start-2" />
                </div>
              )
            })}
          </div>
        )}

        {chosen.length > 0 && (
          <div className="mt-4 rounded-xl border border-[#f0d9b2] bg-[#fdf3e2] p-4 text-sm">
            <p className="eyebrow mb-1.5">Message preview · {chosen[0].order_no}</p>
            <p>{preview(chosen[0], courierOf(chosen[0].id), row(chosen[0].id).tracking, couriers)}</p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button className="h-11 px-6" disabled={!ready || send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? "Sending…" : `Send to ${chosen.length} customer${chosen.length === 1 ? "" : "s"}`}
          </Button>
          {chosen.length > 0 && !ready && <span className="text-sm text-muted-foreground">Every ticked order needs a courier and tracking ID.</span>}
        </div>
      </section>
    </>
  )
}
