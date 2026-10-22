import { useSettings } from "@/hooks/queries"
import { inr } from "@/lib/format"

export default function Story() {
  const { data: s } = useSettings()
  const cols = [
    ["Shipping", `Across India in 3–6 working days. Free above ${inr(s?.free_ship_above ?? 5000)}, otherwise ${inr(s?.ship_fee ?? 150)}. Every parcel is insured.`],
    ["Returns", "7 days from delivery, unworn with tags. Stitched and made-to-size pieces can be altered, not returned."],
    ["Saree care", "Dry clean silks. Store folded in muslin, never plastic. Refold along new lines every few months so the zari doesn't crack."],
    ["Contact", "Video-call shopping 10am–8pm, Monday to Saturday. Write to us and we'll set up a time."],
  ]
  return (
    <>
      <section className="container-x pt-8 md:pt-12">
        <p className="eyebrow">Our story</p>
        <h1 className="mt-3.5 text-[clamp(40px,6vw,76px)] leading-none">The music of colours</h1>
      </section>
      <section className="container-x grid items-center gap-8 pt-10 md:grid-cols-[1.1fr_1fr] md:gap-16">
        <figure className="aspect-[4/5] max-h-[560px] overflow-hidden rounded-2xl"><img src="/brand/aubergine-yaman.jpg" alt="Model in an aubergine Banarasi saree" className="size-full object-cover" /></figure>
        <div className="space-y-4">
          <p className="eyebrow">Why ragas?</p>
          <h2 className="text-[clamp(30px,3.6vw,46px)] leading-none">A colour sets a mood <em className="text-rust">before a word is said.</em></h2>
          <p className="max-w-[46ch] text-muted-foreground">In Indian classical music every raga belongs to an hour and a feeling — Bhairavi for morning, Yaman for dusk, Megh for the rains. When we choose a weave, we ask the same question: what time of day does this belong to, and how should it make you feel?</p>
          <p className="max-w-[46ch] text-muted-foreground">We work directly with weaving families in Kanchipuram and Varanasi, buy in small batches, and photograph every piece in daylight so the colour you see is the colour you get.</p>
        </div>
      </section>
      <section className="container-x grid gap-8 pt-12 sm:grid-cols-2 lg:grid-cols-4">
        {cols.map(([t, b]) => <div key={t}><h3 className="text-[22px]">{t}</h3><p className="mt-2.5 text-sm text-muted-foreground">{b}</p></div>)}
      </section>
    </>
  )
}
