import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = { value: number; onChange: (n: number) => void; min?: number; max?: number; size?: "sm" | "md"; label?: string }

export function QtyStepper({ value, onChange, min = 1, max = 99, size = "md", label }: Props) {
  const h = size === "sm" ? "h-8" : "h-12"
  return (
    <div className={cn("inline-flex items-center rounded-full border bg-paper", h)}>
      {label && <span className="pl-3 pr-1 text-xs font-bold text-muted-foreground">{label}</span>}
      <button type="button" aria-label="Decrease" className="grid h-full w-9 place-items-center disabled:opacity-30"
        disabled={value <= min} onClick={() => onChange(value - 1)}><Minus className="size-3.5" /></button>
      <span className="min-w-5 text-center text-sm font-bold tabular-nums">{value}</span>
      <button type="button" aria-label="Increase" className="grid h-full w-9 place-items-center disabled:opacity-30"
        disabled={value >= max} onClick={() => onChange(value + 1)}><Plus className="size-3.5" /></button>
    </div>
  )
}
