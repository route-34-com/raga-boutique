import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { PageHead } from "@/components/admin/AdminLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, api, del, post, put } from "@/lib/api"

type S = { free_ship_above: number; ship_fee: number; low_stock_at: number }
type AdminRow = { id: number; phone: string; name: string; is_you: boolean }

export default function Settings() {
  const qc = useQueryClient()
  const { data: s } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api<S>("/api/admin/settings") })
  const { data: admins = [] } = useQuery({ queryKey: ["admin", "admins"], queryFn: () => api<AdminRow[]>("/api/admin/admins") })
  const [form, setForm] = useState<S>({ free_ship_above: 5000, ship_fee: 150, low_stock_at: 2 })
  const [phone, setPhone] = useState("")
  useEffect(() => { if (s) setForm(s) }, [s])
  const fail = (e: Error) => toast.error(e instanceof ApiError ? e.message : "Something went wrong.")

  const save = useMutation({ mutationFn: () => put("/api/admin/settings", form), onSuccess: () => { qc.invalidateQueries(); toast.success("Settings saved.") }, onError: fail })
  const addAdmin = useMutation({ mutationFn: () => post("/api/admin/admins", { phone }), onSuccess: () => { setPhone(""); qc.invalidateQueries({ queryKey: ["admin", "admins"] }); toast("Admin added.") }, onError: fail })
  const removeAdmin = useMutation({ mutationFn: (id: number) => del(`/api/admin/admins/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "admins"] }); toast("Admin removed.") }, onError: fail })

  const num = (k: keyof S, label: string) => (
    <div className="grid gap-1.5"><Label htmlFor={k}>{label}</Label>
      <Input id={k} type="number" min={0} value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} /></div>
  )
  return (
    <>
      <PageHead eyebrow="Store" title="Settings" />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-4 text-xl">Shipping &amp; stock</h3>
          <form className="grid gap-3.5" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
            {num("free_ship_above", "Free shipping above ₹")}
            {num("ship_fee", "Shipping fee below that ₹")}
            {num("low_stock_at", "Warn me when stock is at or below")}
            <Button className="h-10 w-fit px-5" disabled={save.isPending}>Save settings</Button>
          </form>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-1 text-xl">Admins</h3>
          <p className="mb-3 text-sm text-muted-foreground">These numbers can log in to this panel with an OTP.</p>
          {admins.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b py-3 text-sm">
              <div><strong>{a.phone}</strong> <span className="text-muted-foreground">{a.name}</span></div>
              {a.is_you ? <span className="text-xs text-muted-foreground">You</span>
                : <Button size="sm" variant="destructive" onClick={() => confirm(`Remove ${a.phone} as admin?`) && removeAdmin.mutate(a.id)}>Remove</Button>}
            </div>
          ))}
          <form className="mt-4 flex gap-2.5" onSubmit={(e) => { e.preventDefault(); if (/^[6-9]\d{9}$/.test(phone)) addAdmin.mutate(); else toast.error("Enter a valid 10-digit mobile number.") }}>
            <label className="flex flex-1 items-center overflow-hidden rounded-lg border bg-white"><span className="border-r px-2.5 text-sm text-muted-foreground">+91</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="Staff mobile" className="h-9 flex-1 px-2.5 text-sm outline-none" /></label>
            <Button className="h-9 px-4">Add admin</Button>
          </form>
        </section>
      </div>
    </>
  )
}
