import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { monthLabel, shiftMonth, thisMonth } from "@/lib/dates"
import { cn } from "@/lib/utils"



export function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  const atNow = value >= thisMonth()
  return (
    <div className="flex items-center gap-1 rounded-full border bg-card p-1">
      <Button size="icon-sm" variant="ghost" className="rounded-full" aria-label="Previous month" onClick={() => onChange(shiftMonth(value, -1))}><ChevronLeft /></Button>
      <span className="min-w-32 text-center text-sm font-semibold">{monthLabel(value)}</span>
      <Button size="icon-sm" variant="ghost" className="rounded-full" aria-label="Next month" disabled={atNow} onClick={() => onChange(shiftMonth(value, 1))}><ChevronRight /></Button>
    </div>
  )
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-heading text-[26px] leading-tight", tone === "good" && "text-[#0f8a5f]", tone === "bad" && "text-[#b4532a]")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={cn("grid gap-1.5 text-[13px] font-semibold", className)}>{label}{children}</label>
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
}
