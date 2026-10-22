import { Link, useNavigate, useParams, useSearchParams } from "react-router"

import { ProductCard } from "@/components/store/ProductCard"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCategories, useProducts } from "@/hooks/queries"
import { MOODS } from "@/lib/format"
import { cn } from "@/lib/utils"

function Chip({ to, on, children }: { to: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link to={to} className={cn("whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium ring-1 transition",
      on ? "bg-cocoa text-background ring-cocoa" : "bg-paper ring-border hover:ring-cocoa")}>{children}</Link>
  )
}

export default function Shop() {
  const { cat } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const mood = params.get("mood") ?? undefined
  const sort = params.get("sort") ?? "featured"
  const { data: cats = [] } = useCategories()
  const { data: products, isLoading } = useProducts({ cat, mood, sort })

  const href = (nextCat: string | undefined, nextMood: string | undefined) => {
    const q = new URLSearchParams()
    if (nextMood) q.set("mood", nextMood)
    if (sort !== "featured") q.set("sort", sort)
    return `/shop${nextCat ? "/" + nextCat : ""}${q.size ? "?" + q : ""}`
  }
  const title = mood ? MOODS[mood]?.label : cat ? cats.find((c) => c.id === cat)?.name : "Shop all"
  const sub = mood ? MOODS[mood]?.note : "Handwoven, small-batch, named for the music they remind us of."

  return (
    <>
      <section className="container-x pt-8 md:pt-16">
        <p className="eyebrow"><Link to="/" className="hover:underline">Home</Link> / Shop</p>
        <h1 className="mb-2.5 mt-3.5 text-[clamp(40px,6vw,76px)] leading-none">{title ?? "Shop"}</h1>
        <p className="text-muted-foreground">{sub}</p>
      </section>
      <section className="container-x pt-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y py-4">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <Chip to={href(undefined, mood)} on={!cat}>All</Chip>
            {cats.map((c) => <Chip key={c.id} to={href(c.id, mood)} on={cat === c.id}>{c.name}</Chip>)}
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <Chip to={href(cat, undefined)} on={!mood}>Any mood</Chip>
            {Object.entries(MOODS).map(([k, m]) => <Chip key={k} to={href(cat, k)} on={mood === k}>{m.label}</Chip>)}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground lg:ml-auto">
            Sort
            <Select value={sort} onValueChange={(v) => { const q = new URLSearchParams(params); if (v === "featured") q.delete("sort"); else q.set("sort", v); navigate({ search: q.toString() }) }}>
              <SelectTrigger className="h-9 w-44 bg-paper text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="low">Price: low to high</SelectItem>
                <SelectItem value="high">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="my-5 text-sm text-muted-foreground">{products ? `${products.length} ${products.length === 1 ? "piece" : "pieces"}` : " "}</p>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:gap-7 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />)}</div>
        ) : products?.length ? (
          <div className="grid grid-cols-2 gap-3 md:gap-7 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        ) : (
          <div className="flex flex-col items-center gap-5 py-16 text-center">
            <p className="font-heading text-xl italic text-rust">Nothing here just yet.</p>
            <Button asChild className="rounded-full px-6"><Link to="/shop">See everything</Link></Button>
          </div>
        )}
      </section>
    </>
  )
}
