import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router"

import { PageHead } from "@/components/admin/AdminLayout"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api"
import { fmtDate, fmtPhone, inr } from "@/lib/format"

type Customer = { id: number; name: string; phone: string; email: string; is_admin: boolean; orders: number; spent: number; last_order_at: string | null }

export default function Customers() {
  const [q, setQ] = useState("")
  const { data } = useQuery({ queryKey: ["admin", "customers", q], queryFn: () => api<Customer[]>(`/api/admin/customers?q=${encodeURIComponent(q)}`) })
  return (
    <>
      <PageHead eyebrow="People" title="Customers">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email" className="h-10 w-full bg-card sm:w-72" />
      </PageHead>
      <section className="overflow-x-auto rounded-2xl border bg-card p-5">
        {!data ? <Skeleton className="h-40" /> : (
          <Table className="min-w-[680px]">
            <TableHeader><TableRow>{["Name", "Phone", "Orders", "Spent", "Last order", ""].map((h) => <TableHead key={h} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><strong>{c.name || "—"}</strong>{c.is_admin && <span className="ml-2 rounded bg-marigold/30 px-1.5 py-0.5 text-[10px] font-bold uppercase">Admin</span>}<br /><span className="text-xs text-muted-foreground">{c.email}</span></TableCell>
                  <TableCell className="whitespace-nowrap">{fmtPhone(c.phone)}</TableCell>
                  <TableCell>{c.orders}</TableCell>
                  <TableCell>{inr(c.spent)}</TableCell>
                  <TableCell>{c.last_order_at ? fmtDate(c.last_order_at) : "—"}</TableCell>
                  <TableCell>{c.orders > 0 && <Link className="text-[13px] font-semibold text-rust hover:underline" to={`/admin/orders?q=${encodeURIComponent(c.phone)}`}>Orders →</Link>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  )
}
