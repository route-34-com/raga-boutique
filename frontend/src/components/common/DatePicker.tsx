import { CalendarDays } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fromIso = (s: string) => (s ? new Date(`${s}T00:00:00`) : undefined)

/** Shared date field: shows "6 Nov 2026", opens a calendar, and reads/writes "YYYY-MM-DD". */
export function DatePicker({ value, onChange, max, min, placeholder = "Pick a date", className, "aria-label": ariaLabel }: {
  value: string; onChange: (iso: string) => void; max?: string; min?: string; placeholder?: string; className?: string; "aria-label"?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = fromIso(value)
  const hidden = [...(max ? [{ after: fromIso(max)! }] : []), ...(min ? [{ before: fromIso(min)! }] : [])]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-label={ariaLabel}
          className={cn("h-9 w-full justify-start gap-2 bg-transparent px-2.5 font-normal shadow-xs", !selected && "text-muted-foreground", className)}>
          <CalendarDays className="size-4 opacity-60" />
          {selected ? selected.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={selected} defaultMonth={selected} disabled={hidden} captionLayout="dropdown"
          onSelect={(d) => { if (d) { onChange(toIso(d)); setOpen(false) } }} />
      </PopoverContent>
    </Popover>
  )
}
