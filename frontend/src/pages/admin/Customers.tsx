import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router"

import { PageHead } from "@/components/admin/AdminLayout"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import { fmtDate, fmtPhone, inr } from "@/lib/format"
import { PageLoader } from "@/components/common/PageLoader"

type Customer = { id: number; name: string; phone: string; email: string; is_admin: boolean; orders: number; spent: number; last_order_at: string | null }

export default function Customers() {
  const [q, setQ] = useState("")
  const { data } = useQuery({ queryKey: ["admin", "customers", q], queryFn: () => api<Customer[]>(`/api/admin/customers?q=${encodeURIComponent(q)}`), placeholderData: (prev) => prev })
  if (!data) return <PageLoader />
  return (
    <>
      <PageHead eyebrow="People" title="Customers">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email" className="h-10 w-full bg-card sm:w-72" />
      </PageHead>
      <section className="overflow-x-auto rounded-2xl border bg-card p-5 max-md:px-4 max-md:py-1">
        {!data.length && <p className="py-6 text-center text-muted-foreground">No customers match.</p>}
        <ul className="divide-y md:hidden">
          {data.map((c) => (
            <li key={c.id} className="py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong>{c.name || "—"}</strong>{c.is_admin && <span className="ml-2 rounded bg-marigold/30 px-1.5 py-0.5 text-[10px] font-bold uppercase">Admin</span>}
                  {c.email && <p className="truncate text-xs text-muted-foreground">{c.email}</p>}
                </div>
                <a href={`tel:${c.phone}`} className="-my-1 shrink-0 whitespace-nowrap py-1 font-semibold text-rust">{fmtPhone(c.phone)}</a>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{c.orders} order{c.orders === 1 ? "" : "s"} · {inr(c.spent)}{c.last_order_at && ` · last ${fmtDate(c.last_order_at)}`}</span>
                {c.orders > 0 && <Link className="-my-2 shrink-0 py-2 text-[13px] font-semibold text-rust link-quiet" to={`/admin/orders?q=${encodeURIComponent(c.phone)}`}>Orders →</Link>}
              </div>
            </li>
          ))}
        </ul>
        {data.length > 0 && (
          <div className="max-md:hidden"><Table className="min-w-[680px]">
            <TableHeader><TableRow>{["Name", "Phone", "Orders", "Spent", "Last order", ""].map((h) => <TableHead key={h} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><strong>{c.name || "—"}</strong>{c.is_admin && <span className="ml-2 rounded bg-marigold/30 px-1.5 py-0.5 text-[10px] font-bold uppercase">Admin</span>}<br /><span className="text-xs text-muted-foreground">{c.email}</span></TableCell>
                  <TableCell className="whitespace-nowrap">{fmtPhone(c.phone)}</TableCell>
                  <TableCell>{c.orders}</TableCell>
                  <TableCell>{inr(c.spent)}</TableCell>
                  <TableCell>{c.last_order_at ? fmtDate(c.last_order_at) : "—"}</TableCell>
                  <TableCell>{c.orders > 0 && <Link className="text-[13px] font-semibold text-rust link-quiet" to={`/admin/orders?q=${encodeURIComponent(c.phone)}`}>Orders →</Link>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div>
        )}
      </section>
    </>
  )
}
