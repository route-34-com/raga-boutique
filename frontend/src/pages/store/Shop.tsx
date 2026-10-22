import { ArrowDownWideNarrow, SlidersHorizontal, X } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"

import { FilterPanel } from "@/components/store/FilterPanel"
import { ProductCard } from "@/components/store/ProductCard"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useCategories, useProducts } from "@/hooks/queries"
import { useTitle } from "@/hooks/useTitle"
import { activeCount, applyFilters, labelFor, readSelection, writeSelection, type Selection } from "@/lib/filters"
import { MOODS } from "@/lib/format"
import NotFound from "@/pages/store/NotFound"

const SORTS: [string, string][] = [
  ["featured", "Featured"], ["popular", "Popularity"], ["new", "Newest first"], ["discount", "Biggest discount"],
  ["low", "Price: low to high"], ["high", "Price: high to low"],
]

function SortMenu({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Sort" className="h-10 gap-2 rounded-lg border-cocoa/30 bg-paper px-3 text-sm text-foreground">
        <ArrowDownWideNarrow className="size-4 text-rust" />
        <span>Sort by <strong className="font-semibold">{SORTS.find(([k]) => k === value)?.[1]}</strong></span>
      </SelectTrigger>
      <SelectContent position="popper" align="end" sideOffset={6} className="min-w-52">{SORTS.map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
    </Select>
  )
}

export default function Shop() {
  const { cat } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState(false)
  const sort = params.get("sort") ?? "featured"
  const search = params.get("q")?.trim() || undefined
  const selection = readSelection(params)
  const { data: cats = [] } = useCategories()
  const { data: all, isLoading } = useProducts({ cat, sort, q: search })
  const products = all ? applyFilters(all, selection) : undefined
  const chosen = activeCount(selection)

  const setSelection = (sel: Selection) => navigate({ search: writeSelection(params, sel).toString() }, { replace: true })
  const setSort = (v: string) => { const q = new URLSearchParams(params); if (v === "featured") q.delete("sort"); else q.set("sort", v); navigate({ search: q.toString() }, { replace: true }) }
  const categoryHref = (id?: string) => `/shop${id ? "/" + id : ""}${params.size ? "?" + params : ""}`

  const onlyMood = selection.mood?.length === 1 && chosen === 1 ? selection.mood[0] : undefined
  const title = search ? `“${search}”` : onlyMood ? MOODS[onlyMood]?.label : cat ? cats.find((c) => c.id === cat)?.name : "Shop all"
  const sub = search ? <>Search results · <Link to={`/shop${cat ? "/" + cat : ""}`} className="underline hover:text-rust">clear search</Link></>
    : onlyMood ? MOODS[onlyMood]?.note : "Handwoven, small-batch, named for the music they remind us of."
  useTitle(search ? `Search: ${search}` : title ?? "Shop")

  if (cat && cats.length && !cats.some((c) => c.id === cat)) return <NotFound />

  const panel = <FilterPanel products={all ?? []} selection={selection} onChange={setSelection} categories={cats} category={cat} categoryHref={categoryHref} />
  const count = products ? `${products.length} ${products.length === 1 ? "piece" : "pieces"}` : ""

  return (
    <>
      <section className="container-x pt-5 md:pt-6">
        <div className="flex flex-col gap-x-8 gap-y-1 md:flex-row md:items-end md:justify-between">
          <h1 className="text-[clamp(36px,4.4vw,56px)] leading-none">{title ?? "Shop"}</h1>
          <p className="text-muted-foreground md:pb-1.5">{sub}</p>
        </div>
      </section>
      <section className="container-x grid items-start gap-10 pt-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto pr-3 [scrollbar-color:#ece1d1_transparent] [scrollbar-width:thin] hover:[scrollbar-color:var(--border)_transparent] lg:block">{panel}</aside>

        <div>
          <div className="flex items-center justify-between gap-3 border-b pb-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" className="h-10 gap-2 rounded-lg border-cocoa/30 bg-paper lg:hidden" onClick={() => setSheet(true)}>
                <SlidersHorizontal className="size-4" />Filters{chosen > 0 && <span className="rounded-full bg-cocoa px-1.5 text-[11px] text-background">{chosen}</span>}
              </Button>
              <p className="text-sm text-muted-foreground max-sm:hidden">{count}</p>
            </div>
            <SortMenu value={sort} onChange={setSort} />
          </div>

          {chosen > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-4">
              {Object.entries(selection).flatMap(([key, values]) => values.map((v) => (
                <button key={key + v} type="button" onClick={() => setSelection({ ...selection, [key]: values.filter((x) => x !== v) })}
                  className="flex items-center gap-1.5 rounded-full bg-sand px-3 py-1 text-[13px] font-medium text-cocoa hover:bg-cocoa hover:text-background">
                  {labelFor(key, v)}<X className="size-3.5" />
                </button>
              )))}
              <button type="button" onClick={() => setSelection({})} className="px-2 text-[13px] font-semibold text-rust hover:underline">Clear all</button>
            </div>
          )}

          <p className="my-4 text-sm text-muted-foreground sm:hidden">{count}</p>
          <div className="sm:pt-5">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 md:gap-6 xl:grid-cols-3 3xl:grid-cols-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />)}</div>
            ) : products?.length ? (
              <div className="grid grid-cols-2 gap-3 md:gap-6 xl:grid-cols-3 3xl:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
            ) : (
              <div className="flex flex-col items-center gap-5 py-16 text-center">
                <p className="font-heading text-xl italic text-rust">
                  {chosen ? "Nothing matches all of those filters." : search ? `Nothing matches “${search}” yet. Try a colour, a fabric or a raga.` : "Nothing here just yet."}
                </p>
                {chosen ? <Button className="rounded-full px-6" onClick={() => setSelection({})}>Clear filters</Button>
                  : <Button asChild className="rounded-full px-6"><Link to="/shop">See everything</Link></Button>}
              </div>
            )}
          </div>
        </div>
      </section>

      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="left" className="w-[88%] gap-0 bg-background p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">Filters</SheetTitle>
          <SheetDescription className="sr-only">Narrow the collection by size, price, colour and more</SheetDescription>
          <div className="flex-1 overflow-y-auto px-5 pt-14">{panel}</div>
          <div className="border-t p-4"><Button className="h-12 w-full rounded-full" onClick={() => setSheet(false)}>Show {count || "pieces"}</Button></div>
        </SheetContent>
      </Sheet>
    </>
  )
}
