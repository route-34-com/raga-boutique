// Shop filters. The whole category is already loaded, so filtering and counting happen in the browser.
// Each group reads and writes one URL parameter (comma-separated values), so a filtered view can be shared.
import { MOODS, ONE_SIZE } from "@/lib/format"
import type { Product } from "@/lib/types"

export type Option = { value: string; label: string; swatch?: string }
export type Group = { key: string; label: string; single?: boolean; options: (products: Product[]) => Option[]; match: (p: Product, value: string) => boolean }

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]
const PRICES: [string, string, number, number][] = [
  ["0-5000", "Under ₹5,000", 0, 5000], ["5000-10000", "₹5,000 – ₹10,000", 5000, 10000],
  ["10000-20000", "₹10,000 – ₹20,000", 10000, 20000], ["20000-", "Above ₹20,000", 20000, Infinity],
]
const DAY = 86_400_000

const discount = (p: Product) => (p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0)
const distinct = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
const textGroup = (key: string, label: string, pick: (p: Product) => string[]): Group => ({
  key, label,
  options: (ps) => distinct(ps.flatMap(pick)).map((v) => ({ value: v, label: v })),
  match: (p, v) => pick(p).includes(v),
})

export const GROUPS: Group[] = [
  {
    key: "size", label: "Size",
    options: (ps) => SIZE_ORDER.filter((s) => ps.some((p) => p.variants.some((v) => v.size === s))).map((s) => ({ value: s, label: s })),
    match: (p, s) => p.variants.some((v) => v.size === s && v.stock > 0),
  },
  {
    key: "price", label: "Price",
    options: () => PRICES.map(([value, label]) => ({ value, label })),
    match: (p, v) => { const [, , lo, hi] = PRICES.find(([k]) => k === v)!; return p.price >= lo && p.price < hi },
  },
  {
    key: "discount", label: "Discount", single: true,
    options: () => [{ value: "10", label: "10% off or more" }, { value: "15", label: "15% off or more" }],
    match: (p, v) => discount(p) >= Number(v),
  },
  {
    key: "color", label: "Colour",
    options: (ps) => distinct(ps.map((p) => p.color)).map((c) => ({ value: c, label: c, swatch: ps.find((p) => p.color === c)?.swatch })),
    match: (p, v) => p.color === v,
  },
  textGroup("material", "Material", (p) => [p.material]),
  textGroup("occasion", "Occasion", (p) => p.occasions),
  textGroup("work", "Work", (p) => [p.work]),
  textGroup("pattern", "Pattern", (p) => [p.pattern]),
  {
    key: "mood", label: "Mood",
    options: (ps) => Object.entries(MOODS).filter(([k]) => ps.some((p) => p.mood === k)).map(([k, m]) => ({ value: k, label: m.label })),
    match: (p, v) => p.mood === v,
  },
  {
    key: "launched", label: "Launched in", single: true,
    options: () => [{ value: "30", label: "Last 30 days" }, { value: "90", label: "Last 3 months" }],
    match: (p, v) => Date.now() - new Date(p.created_at).getTime() <= Number(v) * DAY,
  },
  {
    key: "stock", label: "Availability", single: true,
    options: () => [{ value: "in", label: "In stock only" }],
    match: (p) => p.variants.some((v) => v.stock > 0 && (v.size === ONE_SIZE || SIZE_ORDER.includes(v.size))),
  },
]

export type Selection = Record<string, string[]>

export function readSelection(params: URLSearchParams): Selection {
  return Object.fromEntries(GROUPS.map((g) => [g.key, params.get(g.key)?.split(",").filter(Boolean) ?? []]))
}

export function writeSelection(params: URLSearchParams, sel: Selection): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const g of GROUPS) {
    if (sel[g.key]?.length) next.set(g.key, sel[g.key].join(","))
    else next.delete(g.key)
  }
  return next
}

// Within a group any chosen value may match (Red or Pink); across groups all must match (Red and Silk).
const passes = (p: Product, sel: Selection, skip?: string) =>
  GROUPS.every((g) => g.key === skip || !sel[g.key]?.length || sel[g.key].some((v) => g.match(p, v)))

export const applyFilters = (products: Product[], sel: Selection) => products.filter((p) => passes(p, sel))

// How many pieces each option would show, given everything else that's selected.
export function countFor(products: Product[], sel: Selection, group: Group, value: string) {
  return products.filter((p) => passes(p, sel, group.key) && group.match(p, value)).length
}

export const activeCount = (sel: Selection) => Object.values(sel).reduce((n, v) => n + v.length, 0)

export function labelFor(key: string, value: string) {
  const g = GROUPS.find((x) => x.key === key)
  return g?.options([]).find((o) => o.value === value)?.label ?? (key === "mood" ? MOODS[value]?.label : value) ?? value
}
