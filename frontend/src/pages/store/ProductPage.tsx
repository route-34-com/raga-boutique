import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { toast } from "sonner"

import { QtyStepper } from "@/components/common/QtyStepper"
import { ProductCard, WishButton } from "@/components/store/ProductCard"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useCategories, useProduct, useProducts, useSettings } from "@/hooks/queries"
import { ONE_SIZE, inr, isSized, stockOf } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useCart } from "@/stores/cart"
import NotFound from "@/pages/store/NotFound"

function StockNote({ n, size }: { n: number; size: string | null }) {
  if (!n) return <span className="text-sm font-semibold text-destructive">Sold out{size ? ` in ${size}` : ""}</span>
  if (n <= 3) return <span className="text-sm font-semibold text-rust">Only {n} left</span>
  return <span className="text-sm font-semibold text-emerald-700">In stock</span>
}

export default function ProductPage() {
  const { slug = "" } = useParams()
  const { data: p, isLoading, isError } = useProduct(slug)
  const { data: all = [] } = useProducts()
  const { data: cats = [] } = useCategories()
  const { data: settings } = useSettings()
  const { lines, add, setOpen } = useCart()
  const [img, setImg] = useState(0)
  const [size, setSize] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [pin, setPin] = useState("")
  const [pinMsg, setPinMsg] = useState("")

  useEffect(() => {
    if (!p) return
    setImg(0); setQty(1); setPinMsg("")
    setSize(isSized(p) ? (p.variants.find((v) => v.stock > 0) ?? p.variants[0]).size : null)
  }, [p])

  if (isError) return <NotFound />
  if (isLoading || !p) return (
    <div className="container-x grid gap-10 pt-10 md:grid-cols-[1.15fr_1fr]"><Skeleton className="aspect-[4/5] rounded-2xl" /><div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-40" /></div></div>
  )

  const sized = isSized(p)
  const left = stockOf(p, size)
  const inBag = lines.find((l) => l.productId === p.id && l.size === size)?.qty ?? 0
  const freeAbove = settings?.free_ship_above ?? 5000

  function addToBag() {
    const allowed = Math.min(qty, left - inBag)
    if (allowed <= 0) return toast(`Only ${left} in stock — already in your bag.`)
    add({ productId: p!.id, slug: p!.slug, size, qty: allowed })
    setOpen(true)
  }

  return (
    <>
      <section className="container-x grid items-start gap-8 pt-6 md:grid-cols-[1.15fr_1fr] md:gap-16 md:pt-12">
        <div className="grid gap-3.5 md:sticky md:top-24 md:grid-cols-[76px_1fr]">
          <div className="flex gap-2.5 max-md:order-2 md:flex-col">
            {p.images.map((im, i) => (
              <button key={im.id} onClick={() => setImg(i)} aria-label={`Photo ${i + 1}`}
                className={cn("aspect-[4/5] w-16 overflow-hidden rounded-lg transition md:w-auto", i === img ? "outline-2 outline-offset-2 outline-cocoa" : "opacity-55")}>
                <img src={im.url} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
          <figure className="aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
            <img src={p.images[img]?.url} alt={p.name} className="size-full object-cover" />
          </figure>
        </div>

        <div>
          <p className="eyebrow"><Link to="/shop" className="hover:underline">Shop</Link> / <Link to={`/shop/${p.category_id}`} className="hover:underline">{cats.find((c) => c.id === p.category_id)?.name}</Link></p>
          <p className="mt-4 font-heading text-xl italic text-rust">Raag {p.raga}</p>
          <h1 className="mt-1 text-[clamp(32px,3.4vw,46px)] leading-tight">{p.name}</h1>
          <p className="mb-1 mt-3.5 text-2xl font-semibold">
            {inr(p.price)}
            {p.mrp && p.mrp > p.price && <>
              <s className="ml-2 text-lg font-normal text-muted-foreground">{inr(p.mrp)}</s>
              <span className="ml-2 rounded-md bg-emerald-50 px-2 py-0.5 align-middle text-xs font-bold text-emerald-700">Save {inr(p.mrp - p.price)}</span>
            </>}
          </p>
          <p className="text-sm text-muted-foreground">Inclusive of all taxes. {p.price >= freeAbove ? "Ships free." : `Free shipping above ${inr(freeAbove)}.`}</p>

          {p.raga_note && (
            <blockquote className="my-6 rounded-r-2xl border-l-[3px] border-marigold bg-paper px-5 py-5 font-heading text-[17px] leading-relaxed text-rust/90">{p.raga_note}</blockquote>
          )}

          {sized && (
            <div className="mb-4">
              <span className="mb-2.5 block text-xs font-bold uppercase tracking-[0.12em]">Size</span>
              <div className="flex flex-wrap gap-2">
                {p.variants.filter((v) => v.size !== ONE_SIZE).map((v) => (
                  <button key={v.size} onClick={() => { setSize(v.size); setQty(1) }}
                    className={cn("h-11 w-12 rounded-lg text-sm font-semibold ring-1 transition",
                      size === v.size ? "bg-cocoa text-background ring-cocoa" : "bg-paper ring-border hover:ring-cocoa",
                      !v.stock && "text-muted-foreground line-through")}>{v.size}</button>
                ))}
              </div>
            </div>
          )}
          <p className="mb-4"><StockNote n={left} size={sized ? size : null} /></p>

          <div className="mb-7 flex items-center gap-2.5">
            <QtyStepper value={qty} onChange={setQty} max={Math.max(1, Math.min(5, left))} />
            <Button className="h-12 flex-1 rounded-full text-sm" disabled={!left} onClick={addToBag}>{left ? "Add to bag" : "Sold out"}</Button>
            <WishButton productId={p.id} className="size-12 ring-1 ring-border" />
          </div>

          <form className="mb-6" onSubmit={(e) => { e.preventDefault(); if (/^[1-9]\d{5}$/.test(pin)) setPinMsg(`Delivers to ${pin} in ${pin.startsWith("6") ? "2–3" : "4–6"} working days.`) }}>
            <label htmlFor="pin" className="mb-2.5 block text-xs font-bold uppercase tracking-[0.12em]">Check delivery</label>
            <div className="flex gap-2">
              <Input id="pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit pincode" className="h-12 rounded-full bg-paper px-5" />
              <Button variant="outline" className="h-12 rounded-full border-cocoa bg-transparent px-6">Check</Button>
            </div>
            {pinMsg && <p className="mt-2 text-sm text-muted-foreground">{pinMsg}</p>}
          </form>

          <Accordion type="multiple" defaultValue={["details"]} className="border-t">
            {p.details.length > 0 && <AccordionItem value="details"><AccordionTrigger className="text-[15px] font-semibold">Details</AccordionTrigger>
              <AccordionContent><ul className="list-disc space-y-1 pl-5 text-muted-foreground">{p.details.map((d) => <li key={d}>{d}</li>)}</ul></AccordionContent></AccordionItem>}
            {p.care && <AccordionItem value="care"><AccordionTrigger className="text-[15px] font-semibold">Care</AccordionTrigger><AccordionContent className="text-muted-foreground">{p.care}</AccordionContent></AccordionItem>}
            <AccordionItem value="ship"><AccordionTrigger className="text-[15px] font-semibold">Shipping &amp; returns</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">Dispatched in 2–3 days (made-to-size pieces in 7). Returns within 7 days of delivery if unworn with tags. Stitching services are non-returnable.</AccordionContent></AccordionItem>
          </Accordion>
        </div>
      </section>

      <section className="container-x pt-20">
        <p className="eyebrow">Keep listening</p>
        <h2 className="mb-9 mt-2.5 text-[clamp(30px,3.6vw,46px)]">You may also like</h2>
        <div className="grid grid-cols-2 gap-3 md:gap-7 lg:grid-cols-4">{all.filter((x) => x.id !== p.id).slice(0, 4).map((x) => <ProductCard key={x.id} p={x} />)}</div>
      </section>
    </>
  )
}
