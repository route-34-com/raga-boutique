import { ContactList, SocialLinks } from "@/components/store/StoreLayout"
import { useSettings } from "@/hooks/queries"
import { useTitle } from "@/hooks/useTitle"
import { inr } from "@/lib/format"

export default function Story() {
  useTitle("Our story")
  const { data: s } = useSettings()
  const cols = [
    ["shipping", "Shipping", `Dispatched in 2–3 days and delivered across India in 3–6 working days. Free above ${inr(s?.free_ship_above ?? 5000)}, otherwise ${inr(s?.ship_fee ?? 150)}. Every parcel is insured.`],
    ["returns", "Returns", "Within 7 days of delivery, unworn and with tags. Stitched and made-to-size pieces can be altered, but not returned."],
    ["care", "Saree care", "Dry clean silks. Store folded in muslin, never plastic. Refold along new lines every few months so the zari doesn't crack."],
  ]
  return (
    <>
      <section className="container-x pt-6 md:pt-10">
        <p className="eyebrow">Our story</p>
        <h1 className="mt-3.5 text-[clamp(36px,4.6vw,60px)] leading-none">The music of colours</h1>
      </section>
      <section className="container-x grid items-center gap-8 pt-10 md:grid-cols-[1.1fr_1fr] md:gap-24">
        <figure className="aspect-[4/5] max-h-[640px] overflow-hidden rounded-2xl"><img src="/brand/aubergine-yaman.jpg" alt="Model in an aubergine Banarasi saree" className="size-full object-cover" /></figure>
        <div className="space-y-4">
          <p className="eyebrow">Why ragas?</p>
          <h2 className="text-[clamp(30px,3.6vw,46px)] leading-tight">A colour sets a mood <em className="text-rust">before a word is said.</em></h2>
          <p className="max-w-[46ch] text-muted-foreground">In Indian classical music every raga belongs to an hour and a feeling — Bhairavi for morning, Yaman for dusk, Megh for the rains. When we choose a weave, we ask the same question: what time of day does this belong to, and how should it make you feel?</p>
          <p className="max-w-[46ch] text-muted-foreground">We work directly with weaving families in Kanchipuram and Varanasi, buy in small batches, and photograph every piece in daylight so the colour you see is the colour you get.</p>
        </div>
      </section>
      <section className="container-x grid gap-10 pt-20 sm:grid-cols-2 lg:grid-cols-4">
        {cols.map(([id, t, b]) => (
          <div key={id} id={id} className="scroll-mt-28"><h3 className="text-[22px]">{t}</h3><p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{b}</p></div>
        ))}
        <div id="contact" className="scroll-mt-28">
          <h3 className="text-[22px]">Contact</h3>
          <p className="mb-4 mt-2.5 text-sm leading-relaxed text-muted-foreground">Want to see a drape or the true colour first? Book a video call and we'll walk you through the pieces.</p>
          <ContactList linkClass="text-cocoa hover:text-rust" />
          <SocialLinks className="mt-5" linkClass="text-cocoa hover:bg-cocoa hover:text-background" />
        </div>
      </section>
    </>
  )
}
