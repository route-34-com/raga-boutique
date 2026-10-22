import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Minus, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { PageHead } from "@/components/admin/AdminLayout"
import { ProductSheet } from "@/components/admin/ProductSheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError, api, patch, post } from "@/lib/api"
import { MOODS, ONE_SIZE, cover, inr } from "@/lib/format"
import type { AdminCategory, AdminProduct } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function Products() {
  const qc = useQueryClient()
  const { data: products } = useQuery({ queryKey: ["admin", "products"], queryFn: () => api<AdminProduct[]>("/api/admin/products") })
  const { data: cats = [] } = useQuery({ queryKey: ["admin", "categories"], queryFn: () => api<AdminCategory[]>("/api/admin/categories") })
  const { data: settings } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api<{ low_stock_at: number }>("/api/admin/settings") })
  const [cat, setCat] = useState("all")
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState<AdminProduct | "new" | null>(null)
  const low = settings?.low_stock_at ?? 2

  const refresh = (p: AdminProduct) => {
    qc.setQueryData<AdminProduct[]>(["admin", "products"], (list) => list?.map((x) => (x.id === p.id ? p : x)))
    qc.invalidateQueries({ queryKey: ["products"] })
    qc.invalidateQueries({ queryKey: ["admin", "dashboard"] })
  }
  const stock = useMutation({
    mutationFn: ({ id, size, delta }: { id: number; size: string; delta: number }) => post<AdminProduct>(`/api/admin/products/${id}/stock`, { size, delta }),
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't update stock."),
  })
  const active = useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) => patch<AdminProduct>(`/api/admin/products/${id}/active`, { active: on }),
    onSuccess: (p) => { refresh(p); toast(p.active ? "Now showing on store." : "Hidden from store.") },
  })

  const list = (products ?? []).filter((p) => (cat === "all" || p.category_id === cat) && (!q || `${p.name} ${p.raga}`.toLowerCase().includes(q.toLowerCase())))

  return (
    <>
      <PageHead eyebrow="Catalog" title="Products">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="h-10 w-full bg-card sm:w-56" />
        <Button className="h-10 px-4" onClick={() => setEditing("new")}>+ Add product</Button>
      </PageHead>
      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {[{ id: "all", name: "All", n: products?.length ?? 0 }, ...cats.map((c) => ({ id: c.id, name: c.name, n: c.products }))].map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className={cn("rounded-full border px-3.5 py-1.5 text-[13px] font-semibold", cat === c.id ? "border-cocoa bg-cocoa text-white" : "bg-card")}>
            {c.name} <span className={cat === c.id ? "text-sand" : "text-muted-foreground"}>{c.n}</span>
          </button>
        ))}
      </div>
      <section className="overflow-x-auto rounded-2xl border bg-card p-5">
        {!products ? <Skeleton className="h-60" /> : !list.length ? <p className="py-6 text-center text-muted-foreground">No products yet. Add your first one.</p> : (
          <Table className="min-w-[860px]">
            <TableHeader><TableRow>{["Product", "Category", "Price", "Stock", "On store", ""].map((h) => <TableHead key={h} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {list.map((p) => (
                <TableRow key={p.id} className={cn(!p.active && "opacity-55")}>
                  <TableCell><div className="flex items-center gap-3"><img src={cover(p)} alt="" className="h-[55px] w-11 rounded-lg object-cover" />
                    <div><strong className="whitespace-normal">{p.name}</strong><br /><span className="text-xs text-muted-foreground">Raag {p.raga} · {MOODS[p.mood]?.label ?? "—"}</span></div></div></TableCell>
                  <TableCell>{cats.find((c) => c.id === p.category_id)?.name ?? "—"}</TableCell>
                  <TableCell>{inr(p.price)}{p.mrp && p.mrp > p.price && <><br /><s className="text-xs text-muted-foreground">{inr(p.mrp)}</s></>}</TableCell>
                  <TableCell><div className="flex max-w-[330px] flex-wrap gap-1.5">
                    {p.variants.map((v) => (
                      <div key={v.size} className={cn("inline-flex h-8 items-center rounded-lg border bg-white",
                        v.stock === 0 ? "border-red-200 bg-red-50" : v.stock <= low && "border-[#e7b9a3] bg-[#fff5ef]")}>
                        {v.size !== ONE_SIZE && <span className="pl-2.5 pr-1 text-[11px] font-bold text-muted-foreground">{v.size}</span>}
                        <button aria-label={`Remove one ${v.size}`} disabled={!v.stock || stock.isPending} className="grid h-full w-7 place-items-center disabled:opacity-25" onClick={() => stock.mutate({ id: p.id, size: v.size, delta: -1 })}><Minus className="size-3" /></button>
                        <span className="min-w-5 text-center font-bold tabular-nums">{v.stock}</span>
                        <button aria-label={`Add one ${v.size}`} disabled={stock.isPending} className="grid h-full w-7 place-items-center" onClick={() => stock.mutate({ id: p.id, size: v.size, delta: 1 })}><Plus className="size-3" /></button>
                      </div>
                    ))}
                  </div></TableCell>
                  <TableCell><Switch checked={p.active} aria-label="Show on store" onCheckedChange={(on) => active.mutate({ id: p.id, on })} /></TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => setEditing(p)}>Edit</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      {editing && <ProductSheet key={editing === "new" ? "new" : editing.id} product={editing === "new" ? null : editing} isNew={editing === "new"} onClose={() => setEditing(null)} />}
    </>
  )
}
