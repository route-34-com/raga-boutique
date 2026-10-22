import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LogOut } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"

import { PageLoader } from "@/components/common/PageLoader"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { keys, useAddresses, useMe, useMyOrders } from "@/hooks/queries"
import { ApiError, patch, post } from "@/lib/api"
import { useTitle } from "@/hooks/useTitle"
import { ONGOING, fmtDate, fmtPhone, inr } from "@/lib/format"
import type { OrderSummary, User } from "@/lib/types"
import { LoginPrompt } from "@/pages/store/LoginPrompt"

function OrderRow({ o }: { o: OrderSummary }) {
  return (
    <Link to={`/orders/${o.order_no}`} className="mb-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border bg-paper px-4 py-3.5 transition-colors hover:border-cocoa">
      <div className="flex">{o.items.slice(0, 3).map((it, i) => <img key={i} src={it.image} alt="" className="-ml-3.5 aspect-[4/5] w-12 rounded-lg border-2 border-paper object-cover first:ml-0" />)}</div>
      <div><strong>{o.order_no}</strong><p className="text-xs text-muted-foreground">{fmtDate(o.created_at)} · {o.item_count} item{o.item_count === 1 ? "" : "s"}</p></div>
      <div className="flex flex-col items-end gap-1.5"><StatusBadge status={o.status} /><strong className="text-sm">{inr(o.total)}</strong></div>
    </Link>
  )
}

export default function Account() {
  useTitle("My account")
  const { data: me, isLoading } = useMe()
  const { data: orders, isLoading: loadingOrders } = useMyOrders(!!me)
  const { data: addresses = [] } = useAddresses(!!me)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  useEffect(() => { if (me) { setName(me.name); setEmail(me.email) } }, [me])

  const save = useMutation({
    mutationFn: () => patch<User>("/api/me", { name, email: email || null }),
    onSuccess: (u) => { qc.setQueryData(keys.me, u); toast.success("Profile saved.") },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't save."),
  })

  async function logout() {
    await post("/api/auth/logout")
    qc.setQueryData(keys.me, null)
    qc.removeQueries({ queryKey: keys.myOrders })
    toast("Logged out.")
    navigate("/")
  }

  if (isLoading) return <PageLoader />
  if (!me) return <LoginPrompt title="My account" text="Log in with your mobile number to see your orders." />
  const ongoing = orders?.filter((o) => ONGOING.includes(o.status)) ?? []
  const past = orders?.filter((o) => !ONGOING.includes(o.status)) ?? []

  return (
    <>
      <section className="container-x flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pt-6 md:pt-10">
        <div>
          <h1 className="mb-2 text-[clamp(36px,4.6vw,60px)] leading-none">Hello{me.name ? `, ${me.name.split(" ")[0]}` : ""}.</h1>
          <p className="text-muted-foreground">Signed in as <span className="font-medium text-foreground">{fmtPhone(me.phone)}</span></p>
        </div>
        <Button variant="outline" className="h-11 rounded-full border-cocoa bg-transparent px-5" onClick={logout}>
          <LogOut className="size-4" />Log out
        </Button>
      </section>
      <section className="container-x grid items-start gap-8 pt-8 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
        <div>
          {loadingOrders ? <Skeleton className="h-40 rounded-2xl" /> : !orders?.length ? (
            <div className="flex flex-col items-center gap-5 py-16 text-center">
              <p className="font-heading text-xl italic text-rust">No orders yet.</p>
              <Button asChild className="rounded-full px-6"><Link to="/shop">Start with the edit</Link></Button>
            </div>
          ) : (
            <>
              <h3 className="mb-3 text-xl">Ongoing <span className="text-muted-foreground">{ongoing.length}</span></h3>
              {ongoing.length ? ongoing.map((o) => <OrderRow key={o.id} o={o} />) : <p className="text-sm text-muted-foreground">No orders on the way.</p>}
              <h3 className="mb-3 mt-8 text-xl">Past orders <span className="text-muted-foreground">{past.length}</span></h3>
              {past.length ? past.map((o) => <OrderRow key={o.id} o={o} />) : <p className="text-sm text-muted-foreground">Delivered and cancelled orders will appear here.</p>}
            </>
          )}
        </div>
        <aside className="rounded-2xl bg-paper p-6">
          <h3 className="mb-4 text-[22px]">Profile</h3>
          <form className="grid gap-3.5" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
            <div className="grid gap-1.5"><Label htmlFor="pname">Name</Label><Input id="pname" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-11 bg-background" /></div>
            <div className="grid gap-1.5"><Label htmlFor="pemail">Email</Label><Input id="pemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-11 bg-background" /></div>
            <Button variant="outline" className="h-11 rounded-full border-cocoa bg-transparent" disabled={save.isPending}>Save</Button>
          </form>
          {addresses.length > 0 && <>
            <h3 className="mb-3 mt-7 text-xl">Saved addresses</h3>
            {addresses.map((a) => (
              <p key={a.id} className="mb-3 rounded-xl border bg-background px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                <strong className="text-foreground">{a.name}</strong> · {fmtPhone(a.phone)}<br />
                {a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.state} {a.pincode}
              </p>
            ))}
          </>}
        </aside>
      </section>
    </>
  )
}
