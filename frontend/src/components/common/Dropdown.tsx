import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type Option = { value: string; label: React.ReactNode; disabled?: boolean }

// Radix Select can't hold an empty value, so "" travels as this stand-in.
const NONE = "__none__"

/** Shared dropdown: takes a plain list of options; "" is allowed as a value (e.g. "Not a shop piece"). */
export function Dropdown({ value, onChange, options, placeholder = "Choose…", className, "aria-label": ariaLabel }: {
  value: string; onChange: (v: string) => void; options: Option[]; placeholder?: string; className?: string; "aria-label"?: string
}) {
  return (
    <Select value={value === "" && options.some((o) => o.value === "") ? NONE : value || undefined} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger aria-label={ariaLabel} className={cn("w-full bg-transparent", className)}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent className="max-h-80">
        {options.map((o) => <SelectItem key={o.value || NONE} value={o.value || NONE} disabled={o.disabled}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
