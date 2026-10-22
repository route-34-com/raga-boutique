import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Boxes, LayoutDashboard, ListTree, LogOut, Settings, ShoppingBag, SquareArrowOutUpRight, Users } from "lucide-react"
import { NavLink, Outlet } from "react-router"

import { LoginForm } from "@/components/common/LoginForm"
import { Button } from "@/components/ui/button"
import { keys, useMe } from "@/hooks/queries"
import { api, post } from "@/lib/api"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag, badge: true },
  { to: "/admin/products", label: "Products", icon: Boxes },
  { to: "/admin/categories", label: "Categories", icon: ListTree },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/settings", label: "Settings", icon: Settings },
]

export const useOrderCounts = (enabled = true) =>
  useQuery({ queryKey: ["admin", "order-counts"], queryFn: () => api<Record<string, number>>("/api/admin/orders/counts"), refetchInterval: 20_000, enabled })

function Gate({ denied }: { denied?: string }) {
  const qc = useQueryClient()
  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_30%_20%,#fbe7c4,var(--background)_60%)] p-4">
      <div className="w-full max-w-[400px] rounded-3xl bg-paper p-8 shadow-[0_30px_80px_-40px_rgba(61,29,15,.5)]">
        <img src="/brand/logo-sm.png" alt="Raga" className="mb-4 w-32" />
        <p className="eyebrow mb-3">Store admin</p>
        {denied ? (
          <div className="space-y-4">
            <h3 className="text-2xl">Not an admin</h3>
            <p className="text-sm text-muted-foreground"><strong>{denied}</strong> isn't on the admin list. Ask the store owner to add it under Settings.</p>
            <Button className="h-11 w-full rounded-full" onClick={async () => { await post("/api/auth/logout"); qc.setQueryData(keys.me, null) }}>Use another number</Button>
          </div>
        ) : <LoginForm title="Log in" subtitle="Use the mobile number registered as an admin." />}
      </div>
    </div>
  )
}

export function AdminLayout() {
  const { data: me, isLoading } = useMe()
  const qc = useQueryClient()
  const { data: counts } = useOrderCounts(!!me?.is_admin)
  if (isLoading) return null
  if (!me) return <Gate />
  if (!me.is_admin) return <Gate denied={me.phone} />

  const pending = counts?.placed ?? 0
  return (
    <div className="min-h-screen bg-[#f5f0e8] md:grid md:grid-cols-[236px_1fr]">
      <aside className="sticky top-0 z-30 flex items-center gap-2 overflow-x-auto bg-sidebar px-3 py-2.5 text-sidebar-foreground md:h-screen md:flex-col md:items-stretch md:px-3.5 md:py-5">
        <NavLink to="/admin" className="flex shrink-0 items-center gap-2.5 md:px-2 md:pb-5">
          <img src="/brand/logo-sm.png" alt="Raga" className="w-16 brightness-0 invert-[.9] sepia-[.3] md:w-[92px]" />
          <span className="hidden rounded-md bg-marigold px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-cocoa md:inline">Admin</span>
        </NavLink>
        <nav className="flex gap-0.5 md:flex-col">
          {NAV.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium opacity-80 hover:bg-sidebar-accent hover:opacity-100 md:py-2.5 md:text-sm",
              isActive && "bg-sidebar-accent text-white opacity-100")}>
              <Icon className="hidden size-[18px] md:block" strokeWidth={1.6} />{label}
              {badge && pending > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-marigold px-1.5 text-[11px] font-bold text-cocoa">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden flex-col gap-1.5 px-3 text-[13px] md:flex">
          <a href="/" target="_blank" rel="noopener" className="flex items-center gap-1.5 hover:text-marigold">View store <SquareArrowOutUpRight className="size-3.5" /></a>
          <span className="text-[#b89f8a]">{me.phone}</span>
          <button className="flex items-center gap-1.5 text-left text-marigold" onClick={async () => { await post("/api/auth/logout"); qc.setQueryData(keys.me, null) }}>
            <LogOut className="size-3.5" />Log out
          </button>
        </div>
      </aside>
      <main className="min-w-0 px-4 pb-16 pt-6 md:px-10 md:pt-8"><Outlet /></main>
    </div>
  )
}

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow">{eyebrow}</p><h1 className="mt-1 text-[28px] md:text-[34px]">{title}</h1></div>
      {children && <div className="flex w-full flex-wrap gap-2.5 sm:w-auto">{children}</div>}
    </header>
  )
}
