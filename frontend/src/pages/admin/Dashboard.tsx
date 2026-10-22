import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router"

import { PageHead } from "@/components/admin/AdminLayout"
import { OrderSheet, NEXT_LABEL, nextStatus, useAdvanceOrder } from "@/components/admin/OrderSheet"
import { OrdersTable } from "@/components/admin/OrdersTable"
import { ProductSheet } from "@/components/admin/ProductSheet"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { ONE_SIZE, cover, fmtDate, inr } from "@/lib/format"
import type { AdminOrderRow, AdminProduct } from "@/lib/types"
import { cn } from "@/lib/utils"

type Dash = {
  today: { count: number; total: number }
  month: { count: number; total: number }
  by_status: Record<string, number>
  cod_due: number
  low_stock_at: number
  low_stock: AdminProduct[]
  needs_action: AdminOrderRow[]
  recent: AdminOrderRow[]
}

function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub: string; tone?: "alert" | "warn" }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-2xl border bg-card px-5 py-4",
      tone === "alert" && "border-marigold shadow-[inset_0_3px_0_var(--marigold)]", tone === "warn" && "border-[#e7b9a3] shadow-[inset_0_3px_0_var(--rust)]")}>
      <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
      <strong className="font-heading text-[28px] font-normal leading-tight text-cocoa md:text-[32px]">{value}</strong>
      <span className="text-[13px] text-muted-foreground">{sub}</span>
    </div>
  )
}

export default function Dashboard() {
  const { data: d } = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => api<Dash>("/api/admin/dashboard"), refetchInterval: 20_000 })
  const [orderId, setOrderId] = useState<number | null>(null)
  const [edit, setEdit] = useState<AdminProduct | null>(null)
  const advance = useAdvanceOrder()
  const now = new Date()
  const greet = now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"

  if (!d) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
  const toConfirm = d.by_status.placed ?? 0
  const toShip = (d.by_status.confirmed ?? 0) + (d.by_status.packed ?? 0)

  return (
    <>
      <PageHead eyebrow={now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} title={`Good ${greet}.`} />
      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label="Orders today" value={d.today.count} sub={inr(d.today.total)} />
        <Kpi label="Sales this month" value={inr(d.month.total)} sub={`${d.month.count} orders`} />
        <Kpi label="Waiting for you" value={toConfirm + toShip} sub={`${toConfirm} to confirm · ${toShip} to ship`} tone={toConfirm ? "alert" : undefined} />
        <Kpi label="Low stock" value={d.low_stock.length} sub={`at or below ${d.low_stock_at}`} tone={d.low_stock.length ? "warn" : undefined} />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-2 flex items-baseline justify-between"><h3 className="text-xl">Needs action</h3><Link to="/admin/orders?status=placed" className="text-[13px] font-semibold text-rust hover:underline">All new orders →</Link></div>
          {d.needs_action.length ? d.needs_action.map((o) => {
            const next = nextStatus(o.status)!
            return (
              <div key={o.id} className="flex cursor-pointer flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0" onClick={() => setOrderId(o.id)}>
                <div className="text-sm"><strong>{o.order_no}</strong> <span className="text-muted-foreground">· {o.customer_name}</span>
                  <p className="text-xs text-muted-foreground">{fmtDate(o.created_at, true)} · {o.item_count} item(s) · {inr(o.total)}</p></div>
                <div className="flex items-center gap-2"><StatusBadge status={o.status} />
                  {next !== "shipped"
                    ? <Button size="sm" disabled={advance.isPending} onClick={(e) => { e.stopPropagation(); advance.mutate({ id: o.id, status: next }) }}>{NEXT_LABEL[next]}</Button>
                    : <Button size="sm" onClick={(e) => { e.stopPropagation(); setOrderId(o.id) }}>Add tracking</Button>}
                </div>
              </div>
            )
          }) : <p className="py-6 text-center text-muted-foreground">All caught up. ✨</p>}
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-2 flex items-baseline justify-between"><h3 className="text-xl">Low stock</h3><Link to="/admin/products" className="text-[13px] font-semibold text-rust hover:underline">Products →</Link></div>
          {d.low_stock.length ? d.low_stock.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
              <div className="flex items-center gap-3 text-sm">
                <img src={cover(p)} alt="" className="h-[55px] w-11 rounded-lg object-cover" />
                <div><strong>{p.name}</strong><br />
                  {p.variants.map((v) => <span key={v.size} className={cn("mr-2 text-xs", v.stock <= d.low_stock_at ? "font-bold text-rust" : "text-muted-foreground")}>{v.size === ONE_SIZE ? "Stock" : v.size}: {v.stock}</span>)}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEdit(p)}>Restock</Button>
            </div>
          )) : <p className="py-6 text-center text-muted-foreground">Everything is well stocked.</p>}
        </section>
        <section className="rounded-2xl border bg-card p-5 xl:col-span-2">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-xl">Recent orders</h3>
            <span className="text-[13px] text-muted-foreground">Cash on delivery still to collect: <strong className="text-foreground">{inr(d.cod_due)}</strong></span></div>
          <div className="-mx-5 overflow-x-auto px-5"><OrdersTable orders={d.recent} onOpen={setOrderId} /></div>
        </section>
      </div>
      <OrderSheet key={orderId ?? "none"} id={orderId} onClose={() => setOrderId(null)} />
      {edit && <ProductSheet key={edit.id} product={edit} isNew={false} onClose={() => setEdit(null)} />}
    </>
  )
}
