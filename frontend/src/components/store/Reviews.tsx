import { useMutation, useQueryClient } from "@tanstack/react-query"
import { BadgeCheck, Star } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { keys, useProductReviews, useShopReviews } from "@/hooks/queries"
import { ApiError, post } from "@/lib/api"
import { fmtDate } from "@/lib/format"
import type { MyReview, OrderItem, Review, ReviewWithProduct } from "@/lib/types"
import { cn } from "@/lib/utils"

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5 text-marigold", className)} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1))
        return (
          <span key={i} className="relative inline-block size-[1em]">
            <Star className="absolute inset-0 size-full text-marigold/30" strokeWidth={1.5} fill="currentColor" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="size-[1em]" strokeWidth={1.5} fill="currentColor" />
            </span>
          </span>
        )
      })}
    </span>
  )
}

export function RatingSummary({ slug }: { slug: string }) {
  const { data } = useProductReviews(slug)
  if (!data?.count) return null
  return (
    <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm hover:underline">
      <Stars value={data.average} className="text-base" /><strong>{data.average.toFixed(1)}</strong>
      <span className="text-muted-foreground">· {data.count} review{data.count === 1 ? "" : "s"}</span>
    </a>
  )
}

function ReviewCard({ r, product }: { r: Review; product?: ReviewWithProduct["product"] }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border bg-paper p-6">
      <Stars value={r.rating} className="text-lg" />
      {r.comment && <p className="mt-3.5 flex-1 font-heading text-[17px] leading-relaxed text-cocoa">“{r.comment}”</p>}
      <div className="mt-5 flex items-center justify-between gap-3 text-sm">
        <div>
          <strong>{r.name}</strong>{r.city && <span className="text-muted-foreground"> · {r.city}</span>}
          <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-emerald-700"><BadgeCheck className="size-3.5" />Verified buyer</span>
        </div>
        {!product && <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>}
      </div>
      {product && (
        <Link to={`/p/${product.slug}`} className="mt-4 flex items-center gap-3 border-t pt-4 text-[13px] font-medium hover:text-rust">
          <img src={product.image} alt="" className="aspect-[4/5] w-9 rounded-md object-cover" />{product.name}
        </Link>
      )}
    </article>
  )
}

export function ProductReviews({ slug }: { slug: string }) {
  const { data } = useProductReviews(slug)
  return (
    <section id="reviews" className="container-x scroll-mt-24 pt-12 md:pt-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Reviews</p>
          <h2 className="mt-2.5 text-[clamp(30px,3.6vw,46px)] leading-none">What buyers say</h2>
        </div>
        {!!data?.count && (
          <p className="flex items-center gap-2.5 text-lg"><Stars value={data.average} className="text-xl" />
            <strong>{data.average.toFixed(1)}</strong><span className="text-base text-muted-foreground">from {data.count} review{data.count === 1 ? "" : "s"}</span></p>
        )}
      </div>
      {data?.count ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.reviews.map((r) => <ReviewCard key={r.id} r={r} />)}</div>
      ) : (
        <p className="rounded-2xl border bg-paper px-6 py-5 text-muted-foreground">No reviews yet. Bought this piece? You can rate it from your order once it's delivered.</p>
      )}
    </section>
  )
}

export function Testimonials() {
  const { data } = useShopReviews()
  if (!data?.count) return null
  return (
    <section className="container-x pt-8 md:pt-12">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div><p className="eyebrow">Testimonials</p><h2 className="mt-2.5 text-[clamp(30px,3.6vw,46px)] leading-none">What our customers say</h2></div>
        <p className="flex items-center gap-2.5 text-lg"><Stars value={data.average} className="text-xl" />
          <strong>{data.average.toFixed(1)}</strong><span className="text-base text-muted-foreground">from {data.count} reviews</span></p>
      </div>
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-4">
        {data.reviews.map((r) => <div key={r.id} className="w-[82%] shrink-0 snap-start md:w-auto"><ReviewCard r={r} product={r.product} /></div>)}
      </div>
    </section>
  )
}

export function RateButton({ item, mine }: { item: OrderItem; mine?: MyReview }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState(mine?.comment ?? "")
  const save = useMutation({
    mutationFn: () => post<MyReview>("/api/me/reviews", { product_id: item.product_id, rating, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews"] })
      qc.invalidateQueries({ queryKey: keys.myReviews })
      setOpen(false)
      toast.success("Thank you! Your review is live.")
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't save your review."),
  })
  if (item.product_id === null) return null
  return (
    <>
      <button type="button" onClick={() => { setRating(mine?.rating ?? 0); setComment(mine?.comment ?? ""); setOpen(true) }} className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-rust hover:underline">
        {mine ? <><Stars value={mine.rating} className="text-xs" />Edit your review</> : <><Star className="size-3.5" />Rate this piece</>}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-background sm:max-w-md">
          <DialogTitle className="font-heading text-2xl font-normal text-cocoa">How was it?</DialogTitle>
          <DialogDescription className="flex items-center gap-3">
            <img src={item.image} alt="" className="aspect-[4/5] w-10 rounded-md object-cover" />{item.name}
          </DialogDescription>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!rating) return toast.error("Tap a star to rate it."); save.mutate() }}>
            <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} type="button" aria-label={`${i} star${i > 1 ? "s" : ""}`} onMouseEnter={() => setHover(i)} onClick={() => setRating(i)}
                  className="text-marigold transition-transform hover:scale-110">
                  <Star className="size-9" strokeWidth={1.5} fill={i <= (hover || rating) ? "currentColor" : "transparent"} />
                </button>
              ))}
            </div>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={600} rows={4} className="bg-paper"
              placeholder="The colour, the drape, the fabric, how it felt to wear…" />
            <Button className="h-11 w-full rounded-full" disabled={save.isPending}>{save.isPending ? "Saving…" : mine ? "Update review" : "Post review"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
