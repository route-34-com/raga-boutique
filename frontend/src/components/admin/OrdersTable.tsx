import { StatusBadge } from "@/components/common/StatusBadge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtDate, inr } from "@/lib/format"
import type { AdminOrderRow } from "@/lib/types"

export function OrdersTable({ orders, onOpen }: { orders: AdminOrderRow[]; onOpen: (id: number) => void }) {
  if (!orders.length) return <p className="py-6 text-center text-muted-foreground">No orders match.</p>
  return (
    <Table className="min-w-[720px]">
      <TableHeader>
        <TableRow>{["Order", "Date", "Customer", "Items", "Total", "Payment", "Status"].map((h) => <TableHead key={h} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => (
          <TableRow key={o.id} className="cursor-pointer hover:bg-[#fbf6ee]" onClick={() => onOpen(o.id)}>
            <TableCell className="font-bold">{o.order_no}</TableCell>
            <TableCell>{fmtDate(o.created_at, true)}</TableCell>
            <TableCell>{o.customer_name}<br /><span className="text-xs text-muted-foreground">{o.phone}</span></TableCell>
            <TableCell><div className="flex">{o.items.slice(0, 3).map((it, i) => <img key={i} src={it.image} alt="" className="-ml-2 h-[38px] w-[30px] rounded-md border-2 border-card object-cover first:ml-0" />)}</div></TableCell>
            <TableCell>{inr(o.total)}</TableCell>
            <TableCell><span className="text-muted-foreground">{o.payment_method === "cod" ? "COD" : o.payment_method}</span> · {o.payment_status === "paid" ? "Paid" : "Pending"}</TableCell>
            <TableCell><StatusBadge status={o.status} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
