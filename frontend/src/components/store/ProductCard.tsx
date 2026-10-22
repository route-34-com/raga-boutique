import { Heart } from "lucide-react"
import { Link } from "react-router"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { MOODS, cover, inr } from "@/lib/format"
import type { Product } from "@/lib/types"
import { useCart } from "@/stores/cart"

export function WishButton({ productId, className }: { productId: number; className?: string }) {
  const on = useCart((s) => s.wishlist.includes(productId))
  const toggle = useCart((s) => s.toggleWish)
  return (
    <button type="button" aria-label={on ? "Remove from wishlist" : "Save to wishlist"} aria-pressed={on}
      onClick={(e) => { e.preventDefault(); toast(toggle(productId) ? "Saved to wishlist" : "Removed from wishlist") }}
      className={cn("grid size-10 place-items-center rounded-full bg-paper/90 transition-transform hover:scale-105", className)}>
      <Heart className={cn("size-[18px] stroke-cocoa", on && "fill-rust stroke-rust")} strokeWidth={1.6} />
    </button>
  )
}

export function ProductCard({ p, tall }: { p: Product; tall?: boolean }) {
  const sold = p.total_stock === 0
  const tag = sold ? "Sold out" : p.tag
  return (
    <article className="group relative">
      <Link to={`/p/${p.slug}`} className={cn("relative block overflow-hidden rounded-2xl bg-sand", tall ? "aspect-[4/5] sm:aspect-[5/4]" : "aspect-[4/5]")}>
        <img src={cover(p)} alt={p.name} loading="lazy"
          className={cn("absolute inset-0 size-full object-cover object-top transition duration-700 group-hover:scale-[1.04]", sold && "opacity-75 grayscale-[.6]")} />
        {p.images[1] && <img src={p.images[1].url} alt="" loading="lazy"
          className="absolute inset-0 size-full object-cover opacity-0 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-100" />}
        {tag && <span className="absolute left-3 top-3 rounded-full bg-paper px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-cocoa">{tag}</span>}
      </Link>
      <WishButton productId={p.id} className="absolute right-2.5 top-2.5" />
      <Link to={`/p/${p.slug}`} className="block px-0.5 pt-3.5">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground sm:text-[11px]">
          <i className="inline-block size-2.5 rounded-full ring-1 ring-black/10" style={{ background: p.swatch }} />
          Raag {p.raga}{MOODS[p.mood] ? ` · ${MOODS[p.mood].label}` : ""}
        </span>
        <h3 className="mt-2 mb-1.5 text-base leading-tight sm:text-[19px]">{p.name}</h3>
        <span className="text-[15px] font-semibold">
          {inr(p.price)}{p.mrp && p.mrp > p.price && <s className="ml-1.5 font-normal text-muted-foreground">{inr(p.mrp)}</s>}
        </span>
      </Link>
    </article>
  )
}
