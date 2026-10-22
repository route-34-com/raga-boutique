import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { PageHead } from "@/components/admin/AdminLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, api, del, post, put } from "@/lib/api"
import { fmtPhone } from "@/lib/format"
import type { ContactDetails } from "@/lib/types"

type S = ContactDetails & { free_ship_above: number; ship_fee: number; low_stock_at: number }
type AdminRow = { id: number; phone: string; name: string; is_you: boolean }

const BLANK: S = { free_ship_above: 5000, ship_fee: 150, low_stock_at: 2, contact_phone: "", contact_whatsapp: "", contact_email: "",
  contact_address: "", contact_hours: "", instagram_url: "", facebook_url: "" }

export default function Settings() {
  const qc = useQueryClient()
  const { data: s } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api<S>("/api/admin/settings") })
  const { data: admins = [] } = useQuery({ queryKey: ["admin", "admins"], queryFn: () => api<AdminRow[]>("/api/admin/admins") })
  const [form, setForm] = useState<S>(BLANK)
  const [phone, setPhone] = useState("")
  useEffect(() => { if (s) setForm(s) }, [s])
  const fail = (e: Error) => toast.error(e instanceof ApiError ? e.message : "Something went wrong.")

  const save = useMutation({ mutationFn: () => put("/api/admin/settings", form), onSuccess: () => { qc.invalidateQueries(); toast.success("Settings saved.") }, onError: fail })
  const addAdmin = useMutation({ mutationFn: () => post("/api/admin/admins", { phone }), onSuccess: () => { setPhone(""); qc.invalidateQueries({ queryKey: ["admin", "admins"] }); toast("Admin added.") }, onError: fail })
  const removeAdmin = useMutation({ mutationFn: (id: number) => del(`/api/admin/admins/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "admins"] }); toast("Admin removed.") }, onError: fail })

  const num = (k: "free_ship_above" | "ship_fee" | "low_stock_at", label: string) => (
    <div className="grid gap-1.5"><Label htmlFor={k}>{label}</Label>
      <Input id={k} type="number" min={0} value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} /></div>
  )
  const mobile = (k: "contact_phone" | "contact_whatsapp", label: string) => (
    <div className="grid gap-1.5"><Label htmlFor={k}>{label}</Label>
      <label className="flex items-center overflow-hidden rounded-lg border bg-white focus-within:ring-2 focus-within:ring-ring/50"><span className="border-r px-2.5 text-sm text-muted-foreground">+91</span>
        <input id={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric"
          pattern="[0-9]{10}" title="10-digit number" className="h-9 flex-1 px-2.5 text-sm outline-none" /></label></div>
  )
  const text = (k: "contact_email" | "contact_address" | "contact_hours" | "instagram_url" | "facebook_url", label: string, placeholder: string, type = "text") => (
    <div className="grid gap-1.5"><Label htmlFor={k}>{label}</Label>
      <Input id={k} type={type} value={form[k]} placeholder={placeholder} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
  )

  return (
    <>
      <PageHead eyebrow="Store" title="Settings" />
      <form className="grid items-start gap-4 xl:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-1 text-xl">Contact details</h3>
          <p className="mb-4 text-sm text-muted-foreground">Shown to shoppers in the footer, on the Story page and after they order. Leave a field empty to hide it.</p>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {mobile("contact_whatsapp", "WhatsApp number")}
            {mobile("contact_phone", "Phone number")}
          </div>
          <div className="mt-3.5 grid gap-3.5">
            {text("contact_email", "Email", "hello@yourstore.in", "email")}
            {text("contact_address", "Store address", "Street, area, city, pincode")}
            {text("contact_hours", "Opening hours", "Mon–Sat, 10am–8pm")}
            {text("instagram_url", "Instagram page", "https://www.instagram.com/yourstore/", "url")}
            {text("facebook_url", "Facebook page", "https://www.facebook.com/yourstore/", "url")}
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-4 text-xl">Shipping &amp; stock</h3>
          <div className="grid gap-3.5">
            {num("free_ship_above", "Free shipping above ₹")}
            {num("ship_fee", "Shipping fee below that ₹")}
            {num("low_stock_at", "Warn me when stock is at or below")}
          </div>
        </section>
        <div className="xl:col-span-2"><Button className="h-10 px-5" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save settings"}</Button></div>
      </form>
      <section className="mt-4 rounded-2xl border bg-card p-5 xl:max-w-[calc(50%-0.5rem)]">
        <h3 className="mb-1 text-xl">Admins</h3>
        <p className="mb-3 text-sm text-muted-foreground">These numbers can log in to this panel with an OTP.</p>
        {admins.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 border-b py-3 text-sm">
            <div><strong>{fmtPhone(a.phone)}</strong>{a.name && <span className="ml-2 text-muted-foreground">{a.name}</span>}</div>
            {a.is_you ? <span className="text-xs text-muted-foreground">You</span>
              : <Button size="sm" variant="destructive" onClick={() => confirm(`Remove ${fmtPhone(a.phone)} as admin?`) && removeAdmin.mutate(a.id)}>Remove</Button>}
          </div>
        ))}
        <form className="mt-4 flex gap-2.5" onSubmit={(e) => { e.preventDefault(); if (/^[6-9]\d{9}$/.test(phone)) addAdmin.mutate(); else toast.error("Enter a valid 10-digit mobile number.") }}>
          <label className="flex flex-1 items-center overflow-hidden rounded-lg border bg-white"><span className="border-r px-2.5 text-sm text-muted-foreground">+91</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="Staff mobile" className="h-9 min-w-0 flex-1 px-2.5 text-sm outline-none" /></label>
          <Button className="h-9 px-4">Add admin</Button>
        </form>
      </section>
    </>
  )
}
