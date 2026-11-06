import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { PageHead } from "@/components/admin/AdminLayout"
import { Empty, Field, MonthPicker, Stat } from "@/components/admin/money"
import { dayLabel, thisMonth, today } from "@/lib/dates"
import { DatePicker } from "@/components/common/DatePicker"
import { Dropdown } from "@/components/common/Dropdown"
import { PageLoader } from "@/components/common/PageLoader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ApiError, api, del, post } from "@/lib/api"
import { inr } from "@/lib/format"
import type { AdminProduct } from "@/lib/types"
import { withApproval } from "@/components/common/Confirm"
import { ExportButton } from "@/components/common/ExportButton"

type Purchase = { id: number; bought_on: string; supplier: string; product_id: number | null; item_name: string; size: string | null; qty: number; unit_cost: number; note: string }
const BLANK = { bought_on: today(), supplier: "", product_id: "", size: "", item_name: "", qty: "1", unit_cost: "", note: "" }

export default function Purchases() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(thisMonth())
  const [f, setF] = useState(BLANK)
  const { data: rows } = useQuery({ queryKey: ["admin", "purchases", month], queryFn: () => api<Purchase[]>(`/api/admin/purchases?month=${month}`) })
  const { data: products = [] } = useQuery({ queryKey: ["admin", "products"], queryFn: () => api<AdminProduct[]>("/api/admin/products") })
  const piece = products.find((p) => String(p.id) === f.product_id)
  const sizes = piece?.variants.filter((v) => v.size !== "ONE") ?? []
  const set = (k: keyof typeof BLANK) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const refresh = () => ["purchases", "products", "business", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: ["admin", k] }))
  const fail = (e: Error) => toast.error(e instanceof ApiError ? e.message : "Something went wrong.")

  const add = useMutation({
    mutationFn: () => post("/api/admin/purchases", {
      bought_on: f.bought_on, supplier: f.supplier, note: f.note, qty: Number(f.qty), unit_cost: Number(f.unit_cost),
      product_id: f.product_id ? Number(f.product_id) : null, size: sizes.length ? f.size : null, item_name: f.item_name,
    }),
    onSuccess: () => { toast.success(piece ? `Added. ${piece.name} stock +${f.qty}.` : "Purchase added."); setF({ ...BLANK, bought_on: f.bought_on, supplier: f.supplier }); refresh() },
    onError: fail,
  })
  const remove = useMutation({ mutationFn: (id: number) => del(`/api/admin/purchases/${id}`), onSuccess: () => { toast("Purchase deleted, stock taken back."); refresh() }, onError: fail })

  const total = rows?.reduce((s, r) => s + r.qty * r.unit_cost, 0) ?? 0
  const pieces = rows?.reduce((s, r) => s + r.qty, 0) ?? 0
  const margin = piece && Number(f.unit_cost) ? Math.round((1 - Number(f.unit_cost) / piece.price) * 100) : null

  const deleteButton = (r: Purchase, big = false) => (
    <Button size={big ? "icon-lg" : "icon-sm"} variant="ghost" aria-label="Delete purchase" className={big ? "-my-1.5 -mr-2" : undefined}
      onClick={withApproval({ title: "Delete this purchase?", body: `${r.item_name}${r.size ? ` (${r.size})` : ""} · ${r.qty} × ${inr(r.unit_cost)}.${r.product_id ? ` Its stock goes back down by ${r.qty}.` : ""}`, action: "Delete purchase" }, () => remove.mutate(r.id))}><Trash2 /></Button>
  )

  return (
    <>
      <PageHead eyebrow="Money" title="Purchases">
        <MonthPicker value={month} onChange={setMonth} />
        <ExportButton file={`Raga-Purchases-${month}`} sheet={() => ({
          name: "Purchases", header: ["Date", "Piece", "Size", "Supplier", "Qty", "Cost each (₹)", "Total (₹)", "Note"],
          rows: (rows ?? []).map((r) => [r.bought_on, r.item_name, r.size ?? "", r.supplier, r.qty, r.unit_cost, r.qty * r.unit_cost, r.note]),
        })} />
      </PageHead>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Spent on stock" value={inr(total)} sub={`${pieces} piece${pieces === 1 ? "" : "s"} bought`} />
        <Stat label="Purchases" value={String(rows?.length ?? 0)} sub="entries this month" />
        <Stat label="Suppliers" value={String(new Set(rows?.map((r) => r.supplier).filter(Boolean)).size)} sub="bought from" />
      </div>

      <section className="mt-5 rounded-2xl border bg-card p-5">
        <h3 className="mb-1 text-xl">Add a purchase</h3>
        <p className="mb-4 text-sm text-muted-foreground">Pick the piece and its stock goes up. For things that aren't for sale (lining, packing), leave the piece empty and type what it was.</p>
        <form className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
          <Field label="Date"><DatePicker value={f.bought_on} max={today()} onChange={(v) => setF((x) => ({ ...x, bought_on: v }))} /></Field>
          <Field label="Supplier"><Input value={f.supplier} onChange={set("supplier")} placeholder="e.g. Kanchi Silk Weavers" /></Field>
          <Field label="Piece" className="lg:col-span-2">
            <Dropdown value={f.product_id} onChange={(v) => setF((x) => ({ ...x, product_id: v, size: "" }))}
              options={[{ value: "", label: "Not a shop piece" }, ...products.map((p) => ({ value: String(p.id), label: `${p.name} · ${inr(p.price)}` }))]} />
          </Field>
          {!f.product_id && <Field label="What was bought" className="lg:col-span-2"><Input required value={f.item_name} onChange={set("item_name")} placeholder="e.g. Blouse lining, 20 m" /></Field>}
          {sizes.length > 0 && (
            <Field label="Size">
              <Dropdown value={f.size} onChange={(v) => setF((x) => ({ ...x, size: v }))} placeholder="Pick a size"
                options={sizes.map((v) => ({ value: v.size, label: `${v.size} (now ${v.stock})` }))} />
            </Field>
          )}
          <Field label="Quantity"><Input type="number" min={1} required value={f.qty} onChange={set("qty")} /></Field>
          <Field label="Cost per piece (₹)">
            <Input type="number" min={1} required value={f.unit_cost} onChange={set("unit_cost")} placeholder="What you paid" />
            {margin !== null && <span className={margin < 0 ? "text-xs text-[#b4532a]" : "text-xs font-normal text-muted-foreground"}>Sells at {inr(piece!.price)} · {margin}% margin</span>}
          </Field>
          <Field label="Note" className="lg:col-span-2"><Input value={f.note} onChange={set("note")} placeholder="Optional" /></Field>
          <div className="flex items-end lg:col-span-4">
            <Button className="h-10 px-5" disabled={add.isPending}>{add.isPending ? <><Spinner />Saving…</> : `Add purchase${f.qty && f.unit_cost ? ` · ${inr(Number(f.qty) * Number(f.unit_cost))}` : ""}`}</Button>
          </div>
        </form>
      </section>

      <section className="mt-5 rounded-2xl border bg-card p-5">
        <h3 className="mb-2 text-xl">This month</h3>
        {!rows ? <PageLoader className="min-h-40" /> : rows.length ? (
          <>
          <ul className="divide-y text-sm md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <strong className="font-semibold">{r.item_name}{r.size && <span className="font-normal text-muted-foreground"> · {r.size}</span>}</strong>
                    <span className="shrink-0 font-semibold tabular-nums">{inr(r.qty * r.unit_cost)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {dayLabel(r.bought_on)} · {r.qty} × {inr(r.unit_cost)}{r.supplier && ` · ${r.supplier}`}
                    {!r.product_id && <span className="ml-1.5 inline-block whitespace-nowrap rounded bg-sand px-1.5 text-[11px] text-foreground">not for sale</span>}
                  </p>
                </div>
                {deleteButton(r, true)}
              </li>
            ))}
          </ul>
          <div className="-mx-5 overflow-x-auto px-5 max-md:hidden">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 font-semibold">Date</th><th className="font-semibold">Piece</th><th className="font-semibold">Supplier</th>
                <th className="text-right font-semibold">Qty</th><th className="text-right font-semibold">Cost each</th><th className="text-right font-semibold">Total</th><th /></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2.5">{dayLabel(r.bought_on)}</td>
                  <td><strong className="font-semibold">{r.item_name}</strong>{r.size && <span className="text-muted-foreground"> · {r.size}</span>}{!r.product_id && <span className="ml-1.5 rounded bg-sand px-1.5 text-[11px]">not for sale</span>}</td>
                  <td className="text-muted-foreground">{r.supplier || "—"}</td>
                  <td className="text-right">{r.qty}</td><td className="text-right">{inr(r.unit_cost)}</td><td className="text-right font-semibold">{inr(r.qty * r.unit_cost)}</td>
                  <td className="text-right">{deleteButton(r)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          </>
        ) : <Empty>No purchases this month yet.</Empty>}
      </section>
    </>
  )
}
