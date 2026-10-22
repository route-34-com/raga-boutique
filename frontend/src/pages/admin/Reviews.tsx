import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"

import { PageHead } from "@/components/admin/AdminLayout"
import { Stars } from "@/components/store/Reviews"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, api, del } from "@/lib/api"
import { fmtDate, fmtPhone } from "@/lib/format"
import type { AdminReview } from "@/lib/types"

export function useAdminReviews(limit = 200) {
  return useQuery({ queryKey: ["admin", "reviews", limit], queryFn: () => api<AdminReview[]>(`/api/admin/reviews?limit=${limit}`) })
}

export function ReviewRow({ r, onDelete }: { r: AdminReview; onDelete?: (r: AdminReview) => void }) {
  return (
    <div className="grid gap-3 border-b py-4 text-sm last:border-0 md:grid-cols-[220px_1fr_auto] md:items-start">
      <Link to={`/p/${r.product.slug}`} target="_blank" className="flex items-center gap-3 font-medium hover:text-rust">
        <img src={r.product.image} alt="" className="aspect-[4/5] w-10 rounded-md object-cover" />{r.product.name}
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Stars value={r.rating} />
          <span><strong>{r.name}</strong>{r.city && ` · ${r.city}`}</span>
          <span className="text-xs text-muted-foreground">{fmtPhone(r.phone)} · {fmtDate(r.created_at)}</span></div>
        {r.comment && <p className="mt-1.5 leading-relaxed text-muted-foreground">{r.comment}</p>}
      </div>
      {onDelete && <Button variant="outline" size="sm" className="justify-self-start text-destructive" onClick={() => onDelete(r)}><Trash2 className="size-3.5" />Delete</Button>}
    </div>
  )
}

export default function Reviews() {
  const qc = useQueryClient()
  const { data } = useAdminReviews()
  const [q, setQ] = useState("")
  const remove = useMutation({
    mutationFn: (id: number) => del(`/api/admin/reviews/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "reviews"] }); qc.invalidateQueries({ queryKey: ["reviews"] }); toast("Review deleted.") },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't delete."),
  })
  const shown = (data ?? []).filter((r) => !q || `${r.name} ${r.city} ${r.comment} ${r.product.name} ${r.phone}`.toLowerCase().includes(q.toLowerCase()))
  const avg = data?.length ? data.reduce((n, r) => n + r.rating, 0) / data.length : 0
  return (
    <>
      <PageHead eyebrow="Customers" title="Reviews">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, product, words" className="h-10 w-full bg-card sm:w-80" />
      </PageHead>
      {data && data.length > 0 && (
        <p className="mb-3.5 flex items-center gap-2.5 text-sm"><Stars value={avg} className="text-base" /><strong>{avg.toFixed(1)}</strong>
          <span className="text-muted-foreground">from {data.length} reviews · new reviews appear on the site straight away</span></p>
      )}
      <section className="rounded-2xl border bg-card px-5 py-1">
        {!data ? <Skeleton className="my-4 h-40" /> : shown.length ? shown.map((r) => (
          <ReviewRow key={r.id} r={r} onDelete={(r) => confirm(`Delete ${r.name}'s review of ${r.product.name}? This can't be undone.`) && remove.mutate(r.id)} />
        )) : <p className="py-10 text-center text-muted-foreground">{q ? "No reviews match." : "No reviews yet."}</p>}
      </section>
    </>
  )
}
