import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowDown, ArrowUp } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { PageHead } from "@/components/admin/AdminLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ApiError, api, del, patch, post } from "@/lib/api"
import type { AdminCategory } from "@/lib/types"

export default function Categories() {
  const qc = useQueryClient()
  const { data: cats = [] } = useQuery({ queryKey: ["admin", "categories"], queryFn: () => api<AdminCategory[]>("/api/admin/categories") })
  const [name, setName] = useState("")
  const done = (msg?: string) => { qc.invalidateQueries({ queryKey: ["admin", "categories"] }); qc.invalidateQueries({ queryKey: ["categories"] }); if (msg) toast(msg) }
  const fail = (e: Error) => toast.error(e instanceof ApiError ? e.message : "Something went wrong.")

  const add = useMutation({ mutationFn: () => post("/api/admin/categories", { name }), onSuccess: () => { setName(""); done("Category added.") }, onError: fail })
  const update = useMutation({ mutationFn: ({ id, ...b }: { id: string; name?: string; active?: boolean }) => patch(`/api/admin/categories/${id}`, b), onSuccess: () => done(), onError: fail })
  const reorder = useMutation({ mutationFn: (ids: string[]) => post("/api/admin/categories/reorder", { ids }), onSuccess: () => done() })
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/admin/categories/${id}`), onSuccess: () => done("Category deleted."), onError: fail })

  const move = (i: number, dir: number) => { const ids = cats.map((c) => c.id);[ids[i], ids[i + dir]] = [ids[i + dir], ids[i]]; reorder.mutate(ids) }

  return (
    <>
      <PageHead eyebrow="Catalog" title="Categories" />
      <section className="max-w-3xl rounded-2xl border bg-card p-5">
        {cats.map((c, i) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
            <div className="flex min-w-60 flex-1 flex-col gap-1">
              <Input defaultValue={c.name} aria-label="Category name" className="max-w-80"
                onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && update.mutate({ id: c.id, name: e.target.value.trim() }, { onSuccess: () => toast("Renamed.") })} />
              <span className="text-xs text-muted-foreground">{c.products} product{c.products === 1 ? "" : "s"} · /shop/{c.id}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={!i} onClick={() => move(i, -1)}><ArrowUp /></Button>
              <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={i === cats.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
              <Switch checked={c.active} aria-label="Show in store menu" onCheckedChange={(v) => update.mutate({ id: c.id, active: v })} />
              <Button size="sm" variant="destructive" disabled={c.products > 0} title={c.products ? "Move or delete its products first" : ""}
                onClick={() => confirm(`Delete “${c.name}”?`) && remove.mutate(c.id)}>Delete</Button>
            </div>
          </div>
        ))}
        <form className="mt-4 flex gap-2.5" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate() }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Lehengas" />
          <Button className="h-9 px-4">Add</Button>
        </form>
      </section>
    </>
  )
}
