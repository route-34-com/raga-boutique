import { RotateCcw } from "lucide-react"
import { Link } from "react-router"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { GROUPS, activeCount, countFor, type Selection } from "@/lib/filters"
import type { Category, Product } from "@/lib/types"
import { cn } from "@/lib/utils"

type Props = {
  products: Product[]
  selection: Selection
  onChange: (sel: Selection) => void
  categories: Category[]
  category?: string
  categoryHref: (id?: string) => string
}

export function FilterPanel({ products, selection, onChange, categories, category, categoryHref }: Props) {
  const toggle = (key: string, value: string, single?: boolean) => {
    const cur = selection[key] ?? []
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : single ? [value] : [...cur, value]
    onChange({ ...selection, [key]: next })
  }
  const groups = GROUPS.map((g) => ({ g, options: g.options(products) })).filter(({ options }) => options.length > 0)
  const open = ["category", "size", "price", ...GROUPS.filter((g) => selection[g.key]?.length).map((g) => g.key)]
  const row = "flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left text-sm hover:text-rust"

  return (
    <div>
      <div className="mb-1 flex items-center justify-between border-b pb-4">
        <h2 className="font-sans text-lg font-bold">Filters</h2>
        <button type="button" onClick={() => onChange({})} disabled={!activeCount(selection)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-cocoa transition hover:border-cocoa disabled:opacity-40">
          Reset <RotateCcw className="size-3.5" />
        </button>
      </div>
      <Accordion type="multiple" defaultValue={open}>
        <AccordionItem value="category">
          <AccordionTrigger className="py-3.5 text-[15px] font-medium hover:no-underline">Category</AccordionTrigger>
          <AccordionContent className="!h-auto pb-3 [&_a]:!no-underline">
            {[{ id: undefined, name: "All" }, ...categories].map((c) => (
              <Link key={c.id ?? "all"} to={categoryHref(c.id)} className={cn(row, category === c.id && "font-semibold text-rust")}>
                <span className={cn("size-2 rounded-full", category === c.id ? "bg-rust" : "bg-border")} />{c.name}
              </Link>
            ))}
          </AccordionContent>
        </AccordionItem>
        {groups.map(({ g, options }) => (
          <AccordionItem key={g.key} value={g.key}>
            <AccordionTrigger className="py-3.5 text-[15px] font-medium hover:no-underline">
              <span>{g.label}{selection[g.key]?.length ? <span className="ml-2 rounded-full bg-cocoa px-1.5 py-0.5 text-[11px] text-background">{selection[g.key].length}</span> : null}</span>
            </AccordionTrigger>
            <AccordionContent className="!h-auto pb-3">
              {g.key === "size" ? (
                <div className="flex flex-wrap gap-2 px-1 pt-1">
                  {options.map((o) => {
                    const on = selection.size?.includes(o.value), n = countFor(products, selection, g, o.value)
                    return (
                      <button key={o.value} type="button" disabled={!n && !on} onClick={() => toggle("size", o.value)}
                        className={cn("min-w-11 rounded-lg px-3 py-1.5 text-sm ring-1 transition", on ? "bg-cocoa text-background ring-cocoa" : "ring-border hover:ring-cocoa", !n && !on && "opacity-35 line-through")}>
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              ) : options.map((o) => {
                const on = selection[g.key]?.includes(o.value) ?? false
                const n = countFor(products, selection, g, o.value)
                if (!n && !on) return null
                return (
                  <label key={o.value} className={cn(row, "cursor-pointer")}>
                    <Checkbox checked={on} onCheckedChange={() => toggle(g.key, o.value, g.single)} className={g.single ? "rounded-full" : ""} />
                    {o.swatch && <span className="size-4 rounded-full ring-1 ring-black/10" style={{ background: o.swatch }} />}
                    <span className="flex-1">{o.label}</span>
                    <span className="text-xs text-muted-foreground">{n}</span>
                  </label>
                )
              })}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
