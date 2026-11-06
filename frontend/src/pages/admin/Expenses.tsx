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
import { withApproval } from "@/components/common/Confirm"
import { ExportButton } from "@/components/common/ExportButton"

type Expense = { id: number; spent_on: string; category: string; amount: number; note: string }
type ExpenseList = { categories: string[]; items: Expense[] }

export default function Expenses() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(thisMonth())
  const [f, setF] = useState({ spent_on: today(), category: "Rent", amount: "", note: "" })
  const { data } = useQuery({ queryKey: ["admin", "expenses", month], queryFn: () => api<ExpenseList>(`/api/admin/expenses?month=${month}`) })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const refresh = () => ["expenses", "business"].forEach((k) => qc.invalidateQueries({ queryKey: ["admin", k] }))
  const fail = (e: Error) => toast.error(e instanceof ApiError ? e.message : "Something went wrong.")
  const add = useMutation({
    mutationFn: () => post("/api/admin/expenses", { ...f, amount: Number(f.amount) }),
    onSuccess: () => { toast.success("Expense added."); setF((x) => ({ ...x, amount: "", note: "" })); refresh() }, onError: fail,
  })
  const remove = useMutation({ mutationFn: (id: number) => del(`/api/admin/expenses/${id}`), onSuccess: () => { toast("Expense deleted."); refresh() }, onError: fail })

  if (!data) return <PageLoader />
  const total = data.items.reduce((s, r) => s + r.amount, 0)
  const split = Object.entries(data.items.reduce<Record<string, number>>((m, r) => ({ ...m, [r.category]: (m[r.category] ?? 0) + r.amount }), {})).sort((a, b) => b[1] - a[1])

  return (
    <>
      <PageHead eyebrow="Money" title="Expenses">
        <MonthPicker value={month} onChange={setMonth} />
        <ExportButton file={`Raga-Expenses-${month}`} sheet={() => ({
          name: "Expenses", header: ["Date", "Category", "Amount (₹)", "Note"], rows: data.items.map((r) => [r.spent_on, r.category, r.amount, r.note]),
        })} />
      </PageHead>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid content-start gap-4">
          <Stat label="Shop running costs" value={inr(total)} sub={`${data.items.length} entr${data.items.length === 1 ? "y" : "ies"}`} />
          <section className="rounded-2xl border bg-card p-5">
            <h3 className="mb-3 text-xl">Where it went</h3>
            {split.length ? split.map(([cat, amt]) => (
              <div key={cat} className="mb-2.5" title={`${cat}: ${inr(amt)}`}>
                <div className="mb-1 flex justify-between text-sm"><span>{cat}</span><span className="font-semibold">{inr(amt)}</span></div>
                <div className="h-2 rounded-full bg-sand/50"><div className="h-2 rounded-full bg-rust" style={{ width: `${(amt / total) * 100}%` }} /></div>
              </div>
            )) : <Empty>Nothing spent yet.</Empty>}
          </section>
        </div>
        <div className="grid content-start gap-4">
          <section className="rounded-2xl border bg-card p-5">
            <h3 className="mb-3 text-xl">Add an expense</h3>
            <form className="grid gap-3.5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
              <Field label="Date"><DatePicker value={f.spent_on} max={today()} onChange={(v) => setF((x) => ({ ...x, spent_on: v }))} /></Field>
              <Field label="What for"><Dropdown value={f.category} onChange={(v) => setF((x) => ({ ...x, category: v }))} options={data.categories.map((c) => ({ value: c, label: c }))} /></Field>
              <Field label="Amount (₹)"><Input type="number" min={1} required value={f.amount} onChange={set("amount")} /></Field>
              <Field label="Note"><Input value={f.note} onChange={set("note")} placeholder="e.g. AC service" /></Field>
              <div><Button className="h-10 px-5" disabled={add.isPending}>{add.isPending ? <><Spinner />Saving…</> : "Add expense"}</Button></div>
            </form>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h3 className="mb-2 text-xl">This month</h3>
            {data.items.length ? data.items.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0">
                <div><strong className="font-semibold">{r.category}</strong>{r.note && <span className="text-muted-foreground"> · {r.note}</span>}<br /><span className="text-xs text-muted-foreground">{dayLabel(r.spent_on)}</span></div>
                <div className="flex items-center gap-2"><span className="font-semibold">{inr(r.amount)}</span>
                  <Button size="icon-sm" variant="ghost" aria-label="Delete expense" onClick={withApproval({ title: "Delete this expense?", body: `${r.category} · ${inr(r.amount)} on ${dayLabel(r.spent_on)}`, action: "Delete expense" }, () => remove.mutate(r.id))}><Trash2 /></Button></div>
              </div>
            )) : <Empty>No expenses this month yet.</Empty>}
          </section>
        </div>
      </div>
    </>
  )
}
