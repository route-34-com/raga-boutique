import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { PageHead } from "@/components/admin/AdminLayout"
import { Empty, Field, MonthPicker, Stat } from "@/components/admin/money"
import { dayLabel, monthLabel, thisMonth, today } from "@/lib/dates"
import { DatePicker } from "@/components/common/DatePicker"
import { Dropdown } from "@/components/common/Dropdown"
import { PageLoader } from "@/components/common/PageLoader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ApiError, api, del, post, put } from "@/lib/api"
import { inr } from "@/lib/format"
import { cn } from "@/lib/utils"
import { withApproval } from "@/components/common/Confirm"
import { ExportButton } from "@/components/common/ExportButton"

type Leave = { id: number; on: string; days: number; paid: boolean; reason: string }
type Advance = { id: number; given_on: string; amount: number; note: string }
type Payment = { id: number; month: string; base: number; leave_cut: number; advance_cut: number; paid: number; paid_on: string; note: string }
type Person = { id: number; name: string; phone: string; role: string; monthly_salary: number; joined_on: string | null; active: boolean; advance_owed: number; leaves: Leave[]; advances: Advance[]; payments: Payment[] }
type Preview = { base: number; unpaid_leave_days: number; paid_leave_days: number; leave_cut: number; advance_owed: number; advance_cut: number; to_pay: number; payment: Payment | null }

const fail = (e: Error) => toast.error(e instanceof ApiError ? e.message : "Something went wrong.")

function PersonForm({ person, onDone }: { person?: Person; onDone: (p: Person) => void }) {
  const [f, setF] = useState({ name: person?.name ?? "", role: person?.role ?? "", phone: person?.phone ?? "", monthly_salary: String(person?.monthly_salary ?? ""), joined_on: person?.joined_on ?? "", active: person?.active ?? true })
  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, monthly_salary: Number(f.monthly_salary), joined_on: f.joined_on || null }
      return person ? put<Person>(`/api/admin/staff/${person.id}`, body) : post<Person>("/api/admin/staff", body)
    },
    onSuccess: (p) => { toast.success(person ? "Saved." : `${p.name} added.`); onDone(p) }, onError: fail,
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <Field label="Name"><Input required value={f.name} onChange={set("name")} /></Field>
      <Field label="Role"><Input value={f.role} onChange={set("role")} placeholder="e.g. Sales, Tailor" /></Field>
      <Field label="Mobile"><Input value={f.phone} inputMode="numeric" onChange={set("phone")} /></Field>
      <Field label="Monthly salary (₹)"><Input type="number" min={0} required value={f.monthly_salary} onChange={set("monthly_salary")} /></Field>
      <Field label="Joined on"><DatePicker value={f.joined_on} max={today()} placeholder="Not set" onChange={(v) => setF((x) => ({ ...x, joined_on: v }))} /></Field>
      {person && <Field label="Status"><Dropdown value={f.active ? "1" : "0"} onChange={(v) => setF((x) => ({ ...x, active: v === "1" }))} options={[{ value: "1", label: "Working" }, { value: "0", label: "Left" }]} /></Field>}
      <div className="sm:col-span-2"><Button className="h-10 px-5" disabled={save.isPending}>{save.isPending ? <Spinner /> : person ? "Save" : "Add staff"}</Button></div>
    </form>
  )
}

function Salary({ person, month, onSaved }: { person: Person; month: string; onSaved: (p: Person) => void }) {
  const { data: pv } = useQuery({ queryKey: ["admin", "salary", person.id, month, person.payments.length, person.leaves.length, person.advances.length],
    queryFn: () => api<Preview>(`/api/admin/staff/${person.id}/salary?month=${month}`) })
  const pay = useMutation({
    mutationFn: (v: { net: number; leave: number; advance: number }) => post<Person>(`/api/admin/staff/${person.id}/salary`, { month, leave_cut: v.leave, advance_cut: v.advance, paid: v.net, paid_on: today() }),
    onSuccess: (p) => { toast.success(`${monthLabel(month)} salary recorded.`); onSaved(p) }, onError: fail,
  })
  const undo = useMutation({ mutationFn: (id: number) => del(`/api/admin/staff/${person.id}/salary/${id}`), onSuccess: () => onSaved(person), onError: fail })
  if (!pv) return <PageLoader className="min-h-32" />
  return <SalaryForm key={`${pv.leave_cut}-${pv.advance_cut}-${pv.payment?.id ?? 0}`} pv={pv} month={month} pay={pay} undo={undo} />
}

function SalaryForm({ pv, month, pay, undo }: { pv: Preview; month: string; pay: { mutate: (v: { net: number; leave: number; advance: number }) => void; isPending: boolean }; undo: { mutate: (id: number) => void } }) {
  const [cut, setCut] = useState({ leave: String(pv.leave_cut), advance: String(pv.advance_cut) })
  const net = pv.base - Number(cut.leave || 0) - Number(cut.advance || 0)
  if (pv.payment) return (
    <div className="rounded-xl bg-[#0f8a5f]/10 p-4 text-sm">
      <p className="font-semibold text-[#0f8a5f]">✓ Paid {inr(pv.payment.paid)} on {dayLabel(pv.payment.paid_on)}</p>
      <p className="mt-1 text-muted-foreground">Salary {inr(pv.base)} · leave −{inr(pv.payment.leave_cut)} · advance −{inr(pv.payment.advance_cut)}</p>
      <Button size="sm" variant="ghost" className="mt-2 -ml-2" onClick={withApproval({ title: `Undo ${monthLabel(month)} salary?`, body: "The payment entry is removed, and any advance it took back is owed again.", action: "Undo payment" }, () => undo.mutate(pv.payment!.id))}>Undo</Button>
    </div>
  )
  const row = (label: string, value: React.ReactNode, note?: string) => (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm"><span>{label}{note && <span className="block text-xs text-muted-foreground">{note}</span>}</span>{value}</div>
  )
  return (
    <div>
      {row("Monthly salary", <strong>{inr(pv.base)}</strong>)}
      {row("Unpaid leave", <Input type="number" min={0} className="h-8 w-28 text-right" value={cut.leave} onChange={(e) => setCut((c) => ({ ...c, leave: e.target.value }))} />,
        `${pv.unpaid_leave_days} day${pv.unpaid_leave_days === 1 ? "" : "s"} × ${inr(pv.base / 30)}${pv.paid_leave_days ? ` · ${pv.paid_leave_days} paid leave not cut` : ""}`)}
      {row("Advance taken back", <Input type="number" min={0} max={pv.advance_owed} className="h-8 w-28 text-right" value={cut.advance} onChange={(e) => setCut((c) => ({ ...c, advance: e.target.value }))} />,
        pv.advance_owed ? `${inr(pv.advance_owed)} still owed` : "No advance owed")}
      <div className="flex items-center justify-between py-3"><span className="font-semibold">To hand over</span><span className="font-heading text-2xl">{inr(net)}</span></div>
      <Button className="h-10 w-full" disabled={pay.isPending || net < 0} onClick={() => pay.mutate({ net, leave: Number(cut.leave || 0), advance: Number(cut.advance || 0) })}>{pay.isPending ? <Spinner /> : `Mark ${monthLabel(month, true)} salary paid · ${inr(net)}`}</Button>
    </div>
  )
}

function Detail({ person, month, onChange }: { person: Person; month: string; onChange: (p: Person) => void }) {
  const [editing, setEditing] = useState(false)
  const [lv, setLv] = useState({ on: today(), days: "1", paid: "0", reason: "" })
  const [adv, setAdv] = useState({ given_on: today(), amount: "", note: "" })
  const addLeave = useMutation({ mutationFn: () => post<Person>(`/api/admin/staff/${person.id}/leaves`, { ...lv, days: Number(lv.days), paid: lv.paid === "1" }),
    onSuccess: (p) => { toast.success("Leave added."); setLv((x) => ({ ...x, reason: "" })); onChange(p) }, onError: fail })
  const addAdv = useMutation({ mutationFn: () => post<Person>(`/api/admin/staff/${person.id}/advances`, { ...adv, amount: Number(adv.amount) }),
    onSuccess: (p) => { toast.success("Advance recorded."); setAdv((x) => ({ ...x, amount: "", note: "" })); onChange(p) }, onError: fail })
  const remove = useMutation({ mutationFn: ({ kind, id }: { kind: string; id: number }) => api<Person>(`/api/admin/staff/${person.id}/${kind}/${id}`, { method: "DELETE" }), onSuccess: onChange, onError: fail })
  const inMonth = person.leaves.filter((l) => l.on.startsWith(month))

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-2xl">{person.name}</h3><p className="text-sm text-muted-foreground">{[person.role, person.phone, person.joined_on && `since ${dayLabel(person.joined_on)} ${person.joined_on.slice(0, 4)}`].filter(Boolean).join(" · ")}</p></div>
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>{editing ? "Close" : "Edit"}</Button>
        </div>
        {editing && <div className="mt-4"><PersonForm person={person} onDone={(p) => { setEditing(false); onChange(p) }} /></div>}
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5"><h3 className="mb-2 text-xl">Salary · {monthLabel(month)}</h3><Salary person={person} month={month} onSaved={onChange} /></section>
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-3 text-xl">Advances <span className="text-sm font-normal text-muted-foreground">· {inr(person.advance_owed)} owed</span></h3>
          <form className="grid grid-cols-[1fr_1fr_auto] gap-2" onSubmit={(e) => { e.preventDefault(); addAdv.mutate() }}>
            <DatePicker value={adv.given_on} max={today()} onChange={(v) => setAdv((x) => ({ ...x, given_on: v }))} aria-label="Date given" />
            <Input type="number" min={1} required placeholder="₹ amount" value={adv.amount} onChange={(e) => setAdv((x) => ({ ...x, amount: e.target.value }))} aria-label="Amount" />
            <Button size="icon" aria-label="Add advance" disabled={addAdv.isPending}><Plus /></Button>
            <Input className="col-span-3" placeholder="Reason (optional)" value={adv.note} onChange={(e) => setAdv((x) => ({ ...x, note: e.target.value }))} />
          </form>
          {person.advances.length ? person.advances.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
              <span>{dayLabel(a.given_on)}{a.note && <span className="text-muted-foreground"> · {a.note}</span>}</span>
              <span className="flex items-center gap-1 font-semibold">{inr(a.amount)}<Button size="icon-sm" variant="ghost" aria-label="Delete advance" onClick={withApproval({ title: "Delete this advance?", body: `${inr(a.amount)} given on ${dayLabel(a.given_on)}. What's owed goes down by this much.`, action: "Delete advance" }, () => remove.mutate({ kind: "advances", id: a.id }))}><Trash2 /></Button></span>
            </div>
          )) : <Empty>No advances given.</Empty>}
        </section>
      </div>
      <section className="rounded-2xl border bg-card p-5">
        <h3 className="mb-3 text-xl">Leave · {monthLabel(month)} <span className="text-sm font-normal text-muted-foreground">· {inMonth.reduce((s, l) => s + l.days, 0)} day(s)</span></h3>
        <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto_2fr_auto]" onSubmit={(e) => { e.preventDefault(); addLeave.mutate() }}>
          <DatePicker value={lv.on} onChange={(v) => setLv((x) => ({ ...x, on: v }))} aria-label="Leave date" />
          <Dropdown value={lv.days} onChange={(v) => setLv((x) => ({ ...x, days: v }))} aria-label="Length" options={[{ value: "1", label: "Full day" }, { value: "0.5", label: "Half day" }]} />
          <Dropdown value={lv.paid} onChange={(v) => setLv((x) => ({ ...x, paid: v }))} aria-label="Paid or unpaid" options={[{ value: "0", label: "Unpaid" }, { value: "1", label: "Paid" }]} />
          <Input placeholder="Reason (optional)" value={lv.reason} onChange={(e) => setLv((x) => ({ ...x, reason: e.target.value }))} />
          <Button className="h-9" disabled={addLeave.isPending}>Add leave</Button>
        </form>
        {inMonth.length ? inMonth.map((l) => (
          <div key={l.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
            <span>{dayLabel(l.on)} · {l.days === 1 ? "Full day" : "Half day"}{l.reason && <span className="text-muted-foreground"> · {l.reason}</span>}</span>
            <span className="flex items-center gap-1"><span className={cn("rounded px-1.5 text-xs", l.paid ? "bg-sand" : "bg-[#b4532a]/10 text-[#b4532a]")}>{l.paid ? "Paid" : "Unpaid"}</span>
              <Button size="icon-sm" variant="ghost" aria-label="Delete leave" onClick={withApproval({ title: "Delete this leave?", body: `${dayLabel(l.on)} · ${l.days === 1 ? "Full day" : "Half day"}${l.paid ? "" : ". Its salary cut is dropped too."}`, action: "Delete leave" }, () => remove.mutate({ kind: "leaves", id: l.id }))}><Trash2 /></Button></span>
          </div>
        )) : <Empty>No leave this month.</Empty>}
      </section>
    </div>
  )
}

export default function Staff() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(thisMonth())
  const [sel, setSel] = useState<number | "new" | null>(null)
  const { data: staff } = useQuery({ queryKey: ["admin", "staff"], queryFn: () => api<Person[]>("/api/admin/staff") })
  if (!staff) return <PageLoader />
  const current = staff.find((s) => s.id === sel) ?? (sel === "new" ? undefined : staff[0])
  const changed = (p: Person) => { qc.invalidateQueries({ queryKey: ["admin", "staff"] }); qc.invalidateQueries({ queryKey: ["admin", "business"] }); setSel(p.id) }
  const working = staff.filter((s) => s.active)
  const unpaid = working.filter((s) => !s.payments.some((p) => p.month === month))

  return (
    <>
      <PageHead eyebrow="Team" title="Staff">
        <ExportButton file={`Raga-Salary-register-${month}`} sheet={() => ({
          name: "Salary register", header: ["Name", "Role", "Monthly salary (₹)", "Unpaid leave (days)", "Leave cut (₹)", "Advance taken back (₹)", "Paid (₹)", "Paid on", "Advance still owed (₹)", "Status"],
          rows: staff.filter((s) => s.active || s.payments.some((p) => p.month === month)).map((s) => {
            const pay = s.payments.find((p) => p.month === month)
            const unpaid = s.leaves.filter((l) => l.on.startsWith(month) && !l.paid).reduce((n, l) => n + l.days, 0)
            return [s.name, s.role, s.monthly_salary, unpaid, pay?.leave_cut ?? "", pay?.advance_cut ?? "", pay?.paid ?? "", pay?.paid_on ?? "", s.advance_owed, pay ? "Paid" : "Due"]
          }),
        })} />
        <MonthPicker value={month} onChange={setMonth} />
      </PageHead>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Monthly salaries" value={inr(working.reduce((s, p) => s + p.monthly_salary, 0))} sub={`${working.length} working`} />
        <Stat label={`Not yet paid · ${monthLabel(month, true)}`} value={inr(unpaid.reduce((s, p) => s + p.monthly_salary, 0))} sub={unpaid.map((p) => p.name).join(", ") || "Everyone paid"} />
        <Stat label="Advances owed to shop" value={inr(staff.reduce((s, p) => s + p.advance_owed, 0))} />
      </div>
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border bg-card p-2">
          {staff.map((s) => (
            <button key={s.id} onClick={() => setSel(s.id)} className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm hover:bg-sand/40", current?.id === s.id && sel !== "new" && "bg-sand/60", !s.active && "opacity-55")}>
              <span><strong className="font-semibold">{s.name}</strong><span className="block text-xs text-muted-foreground">{s.role || "Staff"}{!s.active && " · left"}</span></span>
              <span className="text-right text-xs">{inr(s.monthly_salary)}{s.payments.some((p) => p.month === month) ? <span className="block text-[#0f8a5f]">paid</span> : s.active && <span className="block text-[#b4532a]">due</span>}</span>
            </button>
          ))}
          <Button variant="ghost" className="mt-1 w-full justify-start" onClick={() => setSel("new")}><Plus />Add staff</Button>
        </aside>
        {sel === "new" || !current ? (
          <section className="rounded-2xl border bg-card p-5"><h3 className="mb-4 text-xl">Add staff</h3><PersonForm onDone={changed} /></section>
        ) : <Detail key={current.id} person={current} month={month} onChange={changed} />}
      </div>
    </>
  )
}
