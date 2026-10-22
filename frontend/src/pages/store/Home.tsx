import { Link } from "react-router"

import { ProductCard } from "@/components/store/ProductCard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCategories, useProducts } from "@/hooks/queries"
import { MOODS, cover, inr } from "@/lib/format"

const SERVICES = [
  ["✦", "Silk Mark certified", "Pure silk weaves come with their certificate."],
  ["✂", "Ready to wear", "Fall, pico and blouse stitching on request."],
  ["◐", "Video-call shopping", "See the drape and the true colour before you buy."],
  ["↺", "7-day returns", "Unworn, with tags, no questions asked."],
]

function SectionHead({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-9 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
      <div><p className="eyebrow">{eyebrow}</p><h2 className="mt-2.5 text-[clamp(30px,3.6vw,46px)] leading-none">{title}</h2></div>
      {aside}
    </div>
  )
}

export default function Home() {
  const { data: products, isLoading } = useProducts()
  const { data: cats = [] } = useCategories()
  const hero = products?.find((p) => p.slug === "hindol")

  return (
    <>
      <section className="container-x grid items-center gap-8 pt-6 md:grid-cols-[1fr_1fr] md:gap-14 md:pt-8">
        <div className="max-md:order-2">
          <p className="eyebrow">Festive edit · Autumn 2026</p>
          <h1 className="my-4 text-[clamp(42px,5.6vw,72px)] leading-[1.02]">Every weave<br />has a <em className="font-light text-rust">raga.</em></h1>
          <p className="max-w-[46ch] text-[17px] text-muted-foreground">
            Handwoven sarees and ethnic wear from Kanchipuram, Varanasi and beyond — each one named after the raga whose mood it carries.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild className="h-12 rounded-full px-7"><Link to="/shop">Shop the edit</Link></Button>
            {cats[0] && <Button asChild variant="outline" className="h-12 rounded-full border-cocoa bg-transparent px-7"><Link to={`/shop/${cats[0].id}`}>{cats[0].name}</Link></Button>}
          </div>
        </div>
        <div className="relative pb-9 pl-7 md:pb-10 md:pl-12">
          <figure className="aspect-[4/4.2] overflow-hidden rounded-t-[160px] rounded-b-2xl md:aspect-auto md:h-[min(68vh,600px)] md:rounded-t-[220px]">
            <img src="/brand/hero-marigold.jpg" alt="Model in a marigold Kanjivaram saree with royal blue border in a temple courtyard"
              className="size-full animate-[drift_18s_ease-in-out_infinite_alternate] object-cover object-[55%_30%]" />
          </figure>
          <figure className="absolute bottom-0 left-0 aspect-[4/5] w-[36%] overflow-hidden rounded-2xl border-[6px] border-background shadow-[0_20px_40px_-18px_rgba(61,29,15,.45)]">
            <img src="/brand/peach-bhairavi.jpg" alt="Model in a peach tissue silk saree" className="size-full object-cover" />
          </figure>
          {hero && (
            <Link to="/p/hindol" className="absolute bottom-14 right-3 inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-xs font-semibold shadow-lg transition-transform hover:-translate-y-0.5 md:bottom-[74px] md:right-5 md:text-sm">
              <i className="size-2.5 rounded-full" style={{ background: hero.swatch }} />Raag Hindol · {inr(hero.price)}
            </Link>
          )}
        </div>
      </section>

      <section className="container-x pt-10 md:pt-16">
        <SectionHead eyebrow="Shop by mood" title="Dress for the hour"
          aside={<p className="max-w-[40ch] text-muted-foreground">Indian classical music gives each raga a time of day and a feeling. We do the same with colour.</p>} />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3.5">
          {Object.entries(MOODS).map(([k, m]) => {
            const p = products?.find((x) => x.mood === k)
            if (!p) return isLoading ? <Skeleton key={k} className="aspect-[3/4.4] rounded-t-[120px] rounded-b-2xl" /> : null
            return (
              <Link key={k} to={`/shop?mood=${k}`} className="group relative isolate aspect-[3/4.4] overflow-hidden rounded-t-[120px] rounded-b-2xl text-white">
                <img src={cover(p)} alt="" loading="lazy" className="absolute inset-0 -z-20 size-full object-cover transition duration-700 group-hover:scale-105" />
                <span className="absolute inset-0 -z-10 bg-gradient-to-t from-[rgba(42,22,12,.75)] to-transparent to-55%" />
                <span className="absolute bottom-8 left-4 font-heading text-xl md:text-2xl">{m.label}</span>
                <span className="absolute bottom-3.5 left-4 text-[11px] uppercase tracking-[0.12em] opacity-85">Raag {p.raga}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="container-x pt-10 md:pt-16">
        <SectionHead eyebrow="The collection" title="New in the edit"
          aside={<Link to="/shop" className="border-b-[1.5px] border-cocoa pb-0.5 font-semibold text-cocoa hover:text-rust">Shop all →</Link>} />
        <div className="grid grid-cols-2 gap-3 md:gap-7 lg:grid-cols-4">
          {isLoading ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />)
            : products?.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      <section className="container-x grid items-center gap-8 pt-10 md:grid-cols-[1.1fr_1fr] md:gap-16 md:pt-16">
        <figure className="aspect-[4/3.4] overflow-hidden rounded-2xl md:aspect-auto md:h-[460px]">
          <img src="/brand/hero-peach.jpg" alt="Model in a peach saree on a garden path" loading="lazy" className="size-full object-cover" />
        </figure>
        <div>
          <p className="eyebrow">Raag Bhairavi</p>
          <h2 className="my-5 text-[clamp(30px,3.6vw,46px)] leading-none">Soft light,<br /><em className="text-rust">quiet gold.</em></h2>
          <p className="mb-6 max-w-[46ch] text-muted-foreground">Blush tissue silk with a zari border that catches the morning rather than demanding it. The saree we reach for when the occasion is close family and good coffee.</p>
          <Button asChild className="h-12 rounded-full px-7"><Link to="/p/bhairavi">See the saree</Link></Button>
        </div>
      </section>

      <section className="container-x pt-10 md:pt-16">
        <div className="grid overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 1 }}>
          {SERVICES.map(([icon, title, body]) => (
            <div key={title} className="bg-paper p-7">
              <span className="mb-4 grid size-10 place-items-center rounded-full bg-sand text-rust">{icon}</span>
              <h4 className="font-heading text-lg text-cocoa">{title}</h4>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {products && products.length > 4 && (
        <section className="container-x pt-10 md:pt-16">
          <SectionHead eyebrow="Also in the edit" title="For the evening after" />
          <div className="grid grid-cols-2 gap-3 md:gap-7">
            {products.slice(4, 6).map((p) => <ProductCard key={p.id} p={p} tall />)}
          </div>
        </section>
      )}
    </>
  )
}
