import { cn } from "@/lib/utils"
import { STATUS_LABEL } from "@/lib/format"
import type { OrderStatus } from "@/lib/types"

const TONE: Record<OrderStatus, string> = {
  placed: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  packed: "bg-violet-100 text-violet-800",
  shipped: "bg-teal-100 text-teal-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
}

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", TONE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  )
}
