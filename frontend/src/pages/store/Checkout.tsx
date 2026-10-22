import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"

import { useCartTotals } from "@/components/store/CartSheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { keys, useAddresses, useMe } from "@/hooks/queries"
import { ApiError, post } from "@/lib/api"
import { cover, inr } from "@/lib/format"
import type { Address } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCart } from "@/stores/cart"
import { LoginPrompt } from "@/pages/store/LoginPrompt"

const EMPTY: Address = { name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" }
const FIELDS: [keyof Address, string, string, boolean][] = [
  ["name", "Full name", "name", false], ["phone", "Phone", "tel-national", false],
  ["line1", "House, street", "address-line1", true], ["line2", "Area, landmark (optional)", "address-line2", true],
  ["city", "City", "address-level2", false], ["state", "State", "address-level1", false], ["pincode", "Pincode", "postal-code", false],
]

export function AddressFields({ value, onChange }: { value: Address; onChange: (a: Address) => void }) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      {FIELDS.map(([k, label, ac, wide]) => (
        <div key={k} className={cn("grid gap-1.5", wide && "sm:col-span-2")}>
          <Label htmlFor={`addr-${k}`} className="text-[13px] font-semibold">{label}</Label>
          <Input id={`addr-${k}`} autoComplete={ac} required={k !== "line2"} value={value[k] ?? ""} className="h-12 bg-paper"
            inputMode={k === "phone" || k === "pincode" ? "numeric" : undefined}
            maxLength={k === "phone" ? 10 : k === "pincode" ? 6 : undefined}
            onChange={(e) => onChange({ ...value, [k]: k === "phone" || k === "pincode" ? e.target.value.replace(/\D/g, "") : e.target.value })} />
        </div>
      ))}
    </div>
  )
}

export default function Checkout() {
  const { data: me, isLoading } = useMe()
  const { data: saved = [] } = useAddresses(!!me)
  const { rows, subtotal, shipping, total } = useCartTotals()
  const clear = useCart((s) => s.clear)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [pick, setPick] = useState<string>("new")
  const [addr, setAddr] = useState<Address>(EMPTY)
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string[]>([])

  useEffect(() => { if (saved.length) setPick(String(saved[0].id)) }, [saved])
  useEffect(() => {
    if (me) { setEmail(me.email); setAddr((a) => ({ ...a, name: a.name || me.name, phone: a.phone || me.phone.replace(/^\+91/, "") })) }
  }, [me])

  const placeOrder = useMutation({
    mutationFn: () => post<{ order_no: string }>("/api/orders", {
      items: rows.map((r) => ({ product_id: r.productId, size: r.size, qty: r.qty })),
      ...(pick === "new" ? { address: { ...addr, line2: addr.line2 || "" } } : { address_id: Number(pick) }),
      email: email || null,
      payment_method: "cod",
    }),
    onSuccess: ({ order_no }) => {
      clear()
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: keys.myOrders })
      qc.invalidateQueries({ queryKey: keys.addresses })
      navigate(`/orders/${order_no}?new=1`)
    },
    onError: (e) => {
      setError(e instanceof ApiError ? (e.details.length ? e.details : [e.message]) : ["Couldn't place the order."])
      qc.invalidateQueries({ queryKey: ["products"] })
    },
  })

  if (!rows.length) return (
    <section className="container-x pt-5 md:pt-6">
      <h1 className="text-[clamp(40px,6vw,76px)]">Checkout</h1>
      <div className="flex flex-col items-center gap-5 py-16"><p className="font-heading text-xl italic text-rust">Your bag is empty.</p>
        <Button asChild className="rounded-full px-6"><Link to="/shop">Shop the edit</Link></Button></div>
    </section>
  )
  if (isLoading) return null
  if (!me) return <LoginPrompt title="Checkout" text="Log in with your mobile number so we can link this order to you and send updates." />

  return (
    <>
      <section className="container-x pt-5 md:pt-6">
        <p className="eyebrow"><Link to="/" className="hover:underline">Home</Link> / Checkout</p>
        <h1 className="mt-3.5 text-[clamp(40px,6vw,76px)] leading-none">Checkout</h1>
      </section>
      <section className="container-x grid items-start gap-8 pt-6 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <form className="max-lg:order-2" onSubmit={(e) => { e.preventDefault(); setError([]); placeOrder.mutate() }}>
          <p className="text-sm text-muted-foreground">Ordering as <strong className="text-foreground">{me.phone}</strong></p>
          <h3 className="mb-3.5 mt-7 text-[22px]">Email for receipt</h3>
          <Input type="email" autoComplete="email" placeholder="Optional" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 bg-paper" />

          <h3 className="mb-3.5 mt-7 text-[22px]">Delivery address</h3>
          {saved.length > 0 && (
            <RadioGroup value={pick} onValueChange={setPick} className="mb-4 gap-2">
              {saved.map((a) => (
                <Label key={a.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border bg-paper p-4 font-normal leading-relaxed", pick === String(a.id) && "border-cocoa ring-1 ring-cocoa")}>
                  <RadioGroupItem value={String(a.id)} className="mt-1" />
                  <span><strong>{a.name}</strong> · {a.phone}<br />{a.line1}{a.line2 && `, ${a.line2}`}, {a.city}, {a.state} {a.pincode}</span>
                </Label>
              ))}
              <Label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border bg-paper p-4 font-normal", pick === "new" && "border-cocoa ring-1 ring-cocoa")}>
                <RadioGroupItem value="new" /> Deliver somewhere else
              </Label>
            </RadioGroup>
          )}
          {pick === "new" && <AddressFields value={addr} onChange={setAddr} />}

          <h3 className="mb-3.5 mt-7 text-[22px]">Payment</h3>
          <RadioGroup value="cod" className="gap-2">
            <Label className="flex items-center gap-3 rounded-xl border border-cocoa bg-paper p-4 font-normal ring-1 ring-cocoa"><RadioGroupItem value="cod" /> Cash / UPI on delivery</Label>
            <Label className="flex cursor-not-allowed items-center gap-3 rounded-xl border bg-paper p-4 font-normal opacity-60">
              <RadioGroupItem value="online" disabled /> Pay online (UPI, cards)
              <span className="ml-auto rounded-md bg-sand px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">Coming soon</span>
            </Label>
          </RadioGroup>

          {error.length > 0 && <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error.map((m) => <p key={m}>{m}</p>)}</div>}
          <Button type="submit" className="mt-6 h-12 w-full rounded-full" disabled={placeOrder.isPending}>
            {placeOrder.isPending ? "Placing order…" : `Place order · ${inr(total)}`}
          </Button>
        </form>

        <aside className="rounded-2xl bg-paper p-6 lg:sticky lg:top-24">
          <h3 className="mb-3.5 text-[22px]">Order summary</h3>
          {rows.map((r) => (
            <div key={`${r.productId}-${r.size}`} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b py-2.5 text-sm">
              <img src={cover(r.product!)} alt="" className="aspect-[4/5] w-14 rounded-lg object-cover" />
              <div><strong className="block">{r.product!.name}</strong><span className="text-xs text-muted-foreground">Raag {r.product!.raga}{r.size && ` · ${r.size}`} · Qty {r.qty}</span></div>
              <span>{inr(r.product!.price * r.qty)}</span>
            </div>
          ))}
          <div className="mt-2.5 flex justify-between py-2"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
          <div className="flex justify-between py-2"><span>Shipping</span><span>{shipping ? inr(shipping) : "Free"}</span></div>
          <div className="mt-1.5 flex justify-between border-t pt-3.5 text-lg"><span>Total</span><strong>{inr(total)}</strong></div>
        </aside>
      </section>
    </>
  )
}
