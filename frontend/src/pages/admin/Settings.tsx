import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { PageHead } from "@/components/admin/AdminLayout"
import { PageLoader } from "@/components/common/PageLoader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, api, del, post, put } from "@/lib/api"
import { fmtPhone } from "@/lib/format"
import type { ContactDetails, Courier } from "@/lib/types"
import { Spinner } from "@/components/ui/spinner"
import { keys } from "@/hooks/queries"
import { BRANDS, applyBrand, type Brand } from "@/lib/brand"
import type { StoreSettings } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Check, Plus, Save, Trash2, UserPlus } from "lucide-react"
import { ActionButton } from "@/components/common/ActionButton"
import { withApproval } from "@/components/common/Confirm"

type S = ContactDetails & { free_ship_above: number; ship_fee: number; low_stock_at: number; couriers: Courier[]; brand_theme: Brand; upi_id: string; upi_name: string; online_payments?: string }
type AdminRow = { id: number; phone: string; name: string; is_you: boolean; is_super: boolean }

const BLANK: S = { free_ship_above: 5000, ship_fee: 150, low_stock_at: 2, contact_phone: "", contact_whatsapp: "", contact_email: "",
  contact_address: "", contact_hours: "", instagram_url: "", facebook_url: "", couriers: [], brand_theme: "plum", upi_id: "", upi_name: "" }

export default function Settings() {
  const qc = useQueryClient()
  const { data: s } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api<S>("/api/admin/settings") })
  const { data: admins = [] } = useQuery({ queryKey: ["admin", "admins"], queryFn: () => api<AdminRow[]>("/api/admin/admins") })
  const [form, setForm] = useState<S>(BLANK)
  const [phone, setPhone] = useState("")
  const canManage = admins.some((a) => a.is_you && a.is_super)
  useEffect(() => { if (s) setForm(s) }, [s])
  // Picking a colour previews it at once; leaving without saving puts the saved one back.
  useEffect(() => () => { qc.invalidateQueries({ queryKey: keys.settings }) }, [qc])
  const pickBrand = (brand: Brand) => {
    setForm((f) => ({ ...f, brand_theme: brand }))
    qc.setQueryData<StoreSettings>(keys.settings, (old) => (old ? { ...old, brand_theme: brand } : old))
    applyBrand(brand)
  }
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

  if (!s) return <PageLoader />
  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 -mt-6 bg-[#f5f0e8] px-4 pt-6 md:-mx-10 md:-mt-8 md:px-10 md:pt-8">
        <PageHead eyebrow="Store" title="Settings">
          <ActionButton type="submit" form="settings-form" className="h-10 px-5" icon={Save} label="Save settings" disabled={save.isPending} busy={save.isPending ? <Spinner /> : undefined}>{save.isPending ? "Saving…" : "Save settings"}</ActionButton>
        </PageHead>
      </div>
      <form id="settings-form" className="grid items-start gap-4 xl:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        <section className="rounded-2xl border bg-card p-5 xl:col-span-2">
          <h3 className="mb-1 text-xl">Brand colour</h3>
          <p className="mb-4 text-sm text-muted-foreground">Used for the logo, buttons, headings, footer, browser tab icon and order emails. Tap one to preview it here, then press <strong>Save settings</strong> to show it on the shop.</p>
          <div role="radiogroup" aria-label="Brand colour" className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(BRANDS) as Brand[]).map((b) => {
              const on = form.brand_theme === b
              return (
                <button key={b} type="button" role="radio" aria-checked={on} onClick={() => pickBrand(b)}
                  className={cn("flex items-center gap-4 rounded-xl border bg-white p-4 text-left transition", on ? "border-transparent ring-2 ring-[var(--ring)]" : "hover:border-foreground/30")}>
                  <span className="grid size-12 shrink-0 place-items-center rounded-full" style={{ background: BRANDS[b].ink }}>{on && <Check className="size-5 text-white" />}</span>
                  <span className="min-w-0 flex-1"><strong className="block">{BRANDS[b].label}</strong><span className="text-xs text-muted-foreground">{BRANDS[b].note}</span></span>
                  <img src={BRANDS[b].logo} alt="" className="h-9 w-auto" />
                </button>
              )
            })}
          </div>
          {s && form.brand_theme !== s.brand_theme && <p className="mt-3 rounded-lg bg-[#fdf3e2] px-3 py-2 text-sm">Previewing {BRANDS[form.brand_theme].label}. Save settings to show it on the shop.</p>}
        </section>
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
        <div className="grid gap-4">
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-4 text-xl">Shipping &amp; stock</h3>
          <div className="grid gap-3.5">
            {num("free_ship_above", "Free shipping above ₹")}
            {num("ship_fee", "Shipping fee below that ₹")}
            {num("low_stock_at", "Warn me when stock is at or below")}
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-1 text-xl">Online payments</h3>
          {({
            live: <p className="text-sm"><strong className="text-[#0f8a5f]">Razorpay is live.</strong> Shoppers pay by UPI, card, netbanking or wallet, orders are marked paid automatically, and cancelling a paid order refunds it.</p>,
            test: <p className="text-sm"><strong>Razorpay test mode.</strong> Payments use Razorpay's test cards and UPI IDs, no real money moves. Switch to live keys to start taking payments.</p>,
            demo: <p className="text-sm"><strong>Demo mode.</strong> A stand-in payment window is used so the flow can be tried. Add the shop's Razorpay keys to take real payments.</p>,
          } as Record<string, React.ReactNode>)[s.online_payments ?? ""] ?? <p className="text-sm text-muted-foreground">Off. Shoppers pay cash or UPI on delivery. Add the shop's Razorpay keys to take payments online.</p>}
          <p className="mt-2 text-xs text-muted-foreground">Razorpay keys are kept on the server, never in this page.</p>
        </section>
        {!s.online_payments && <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-1 text-xl">UPI payments</h3>
          <p className="mb-4 text-sm text-muted-foreground">Shoppers can choose <strong>Pay now with UPI</strong> at checkout and scan a QR code for the exact amount. Leave the UPI ID empty to hide the option.</p>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="upi_id">Shop UPI ID</Label>
              <Input id="upi_id" value={form.upi_id} placeholder="yourshop@okhdfcbank" pattern="[\w.\-]{2,}@[A-Za-z]{2,}" title="Like name@bank"
                onChange={(e) => setForm({ ...form, upi_id: e.target.value.trim() })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="upi_name">Name shown in the UPI app</Label>
              <Input id="upi_name" value={form.upi_name} placeholder="Raga Boutique" onChange={(e) => setForm({ ...form, upi_name: e.target.value })} /></div>
          </div>
        </section>}
        </div>
        <section className="rounded-2xl border bg-card p-5 xl:col-span-2">
          <h3 className="mb-1 text-xl">Couriers</h3>
          <p className="mb-4 text-sm text-muted-foreground">Used on the Dispatch page. Put <code>{"{id}"}</code> where the tracking ID goes, e.g. https://www.dtdc.in/tracking?awb={"{id}"}. Customers get this link with their tracking ID.</p>
          <div className="grid gap-2.5">
            {form.couriers.map((c, i) => {
              const set = (patch: Partial<Courier>) => setForm({ ...form, couriers: form.couriers.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
              return (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2.5 sm:grid-cols-[200px_1fr_auto]">
                  <Input aria-label="Courier name" value={c.name} required placeholder="DTDC" onChange={(e) => set({ name: e.target.value })} />
                  <Input className="max-sm:col-span-2 max-sm:row-start-2" aria-label="Tracking link" value={c.track_url} type="url" placeholder="https://…{id}" pattern=".*\{id\}.*"
                    title="Include {id} where the tracking ID goes" onChange={(e) => set({ track_url: e.target.value })} />
                  <ActionButton type="button" variant="outline" icon={Trash2} label="Remove courier" className="h-9 sm:h-auto" onClick={withApproval({ title: `Remove ${c.name || "this courier"}?`, body: "It's taken off the Dispatch list when you save settings.", action: "Remove courier" }, () => setForm({ ...form, couriers: form.couriers.filter((_, j) => j !== i) }))}>Remove</ActionButton>
                </div>
              )
            })}
          </div>
          <Button type="button" variant="outline" className="mt-3" onClick={() => setForm({ ...form, couriers: [...form.couriers, { name: "", track_url: "" }] })}><Plus />Add courier</Button>
        </section>
      </form>
      <section className="mt-4 rounded-2xl border bg-card p-5 xl:max-w-[calc(50%-0.5rem)]">
        <h3 className="mb-1 text-xl">Admins</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          These numbers can log in to this panel with an OTP. {canManage ? "As a super admin, you can add or remove admins." : "Only the super admins can add or remove admins."}
        </p>
        {admins.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 border-b py-3 text-sm">
            <div><strong>{fmtPhone(a.phone)}</strong>{a.name && <span className="ml-2 text-muted-foreground">{a.name}</span>}
              {a.is_super && <span className="ml-2 rounded bg-marigold/30 px-1.5 py-0.5 text-[10px] font-bold uppercase">Super admin</span>}</div>
            {a.is_you ? <span className="text-xs text-muted-foreground">You</span>
              : canManage && !a.is_super && <ActionButton size="sm" variant="destructive" className="max-sm:size-9" icon={Trash2} label="Remove admin" onClick={withApproval({ title: `Remove ${fmtPhone(a.phone)} as admin?`, body: "They can no longer open this panel.", action: "Remove admin" }, () => removeAdmin.mutate(a.id))}>Remove</ActionButton>}
          </div>
        ))}
        {canManage && <form className="mt-4 flex gap-2.5" onSubmit={(e) => { e.preventDefault(); if (/^[6-9]\d{9}$/.test(phone)) addAdmin.mutate(); else toast.error("Enter a valid 10-digit mobile number.") }}>
          <label className="flex flex-1 items-center overflow-hidden rounded-lg border bg-white"><span className="border-r px-2.5 text-sm text-muted-foreground">+91</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="Staff mobile" className="h-9 min-w-0 flex-1 px-2.5 text-sm outline-none" /></label>
          <ActionButton className="h-9 px-4 max-sm:size-9" icon={UserPlus} label="Add admin" />
        </form>}
      </section>
    </>
  )
}
