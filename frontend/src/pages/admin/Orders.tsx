import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useSearchParams } from "react-router"

import { PageHead, useOrderCounts } from "@/components/admin/AdminLayout"
import { OrderSheet } from "@/components/admin/OrderSheet"
import { OrdersTable } from "@/components/admin/OrdersTable"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { FLOW, STATUS_LABEL } from "@/lib/format"
import type { AdminOrderRow } from "@/lib/types"
import { cn } from "@/lib/utils"

const TABS: [string, string][] = [["all", "All"], ["ongoing", "Ongoing"], ...FLOW.map((s) => [s, STATUS_LABEL[s]] as [string, string]), ["cancelled", "Cancelled"]]

export default function Orders() {
  const [params, setParams] = useSearchParams()
  const status = params.get("status") ?? "all"
  const q = params.get("q") ?? ""
  const [search, setSearch] = useState(q)
  const [openId, setOpenId] = useState<number | null>(null)
  const { data: counts } = useOrderCounts()
  const { data: orders } = useQuery({
    queryKey: ["admin", "orders", status, q],
    queryFn: () => api<AdminOrderRow[]>(`/api/admin/orders?${new URLSearchParams({ status, q })}`),
    refetchInterval: 20_000,
  })

  return (
    <>
      <PageHead eyebrow="Orders" title="Orders">
        <form className="w-full sm:w-80" onSubmit={(e) => { e.preventDefault(); const n = new URLSearchParams(params); if (search) n.set("q", search); else n.delete("q"); setParams(n) }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order no, phone, name, pincode" className="h-10 bg-card" />
        </form>
      </PageHead>
      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {TABS.map(([k, label]) => (
          <Link key={k} to={`?status=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn("rounded-full border px-3.5 py-1.5 text-[13px] font-semibold", status === k ? "border-cocoa bg-cocoa text-white" : "bg-card")}>
            {label} <span className={status === k ? "text-sand" : "text-muted-foreground"}>{counts?.[k] ?? 0}</span>
          </Link>
        ))}
      </div>
      <section className="overflow-x-auto rounded-2xl border bg-card p-5">
        {orders ? <OrdersTable orders={orders} onOpen={setOpenId} /> : <Skeleton className="h-40" />}
      </section>
      <OrderSheet key={openId ?? "none"} id={openId} onClose={() => setOpenId(null)} />
    </>
  )
}
