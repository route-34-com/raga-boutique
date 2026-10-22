import { cn } from "@/lib/utils"
import { FLOW, STATUS_LABEL, fmtDate } from "@/lib/format"
import type { OrderDetail } from "@/lib/types"

export function OrderTimeline({ order }: { order: OrderDetail }) {
  const at = (s: string) => order.events.find((e) => e.status === s)?.created_at
  const step = FLOW.indexOf(order.status)
  return (
    <ol className="grid gap-0 sm:grid-cols-5">
      {FLOW.map((s, i) => {
        const done = i <= step
        return (
          <li key={s} className="relative pb-5 pl-8 sm:pb-0 sm:pl-0 sm:pt-7">
            {/* connector line */}
            <span className={cn("absolute left-[6px] top-3 bottom-0 w-0.5 sm:left-0 sm:right-0 sm:top-[7px] sm:h-0.5 sm:w-auto",
              i === FLOW.length - 1 && "max-sm:hidden", done ? "bg-marigold" : "bg-border")} />
            <span className={cn("absolute left-0 top-1 size-3.5 rounded-full border-2 sm:top-0",
              done ? "border-marigold bg-marigold" : "border-border bg-background", i === step && "ring-4 ring-marigold/25")} />
            <p className={cn("text-sm font-semibold", done ? "text-cocoa" : "text-muted-foreground")}>{STATUS_LABEL[s]}</p>
            <p className="text-xs text-muted-foreground">{at(s) ? fmtDate(at(s)!, true) : ""}</p>
          </li>
        )
      })}
    </ol>
  )
}
