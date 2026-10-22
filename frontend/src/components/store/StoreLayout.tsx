import { Heart, Menu, ShoppingBag, User } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"

import { CartSheet, useCartTotals } from "@/components/store/CartSheet"
import { LoginDialog } from "@/components/store/LoginDialog"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useCategories, useMe } from "@/hooks/queries"
import { cn } from "@/lib/utils"
import { useCart } from "@/stores/cart"

const PROMOS = ["Free shipping across India above ₹5,000", "Fall, pico & blouse stitching on request", "Silk Mark certified weaves", "Video-call shopping, 10am–8pm"]

function NavLinks({ className, onClick }: { className?: string; onClick?: () => void }) {
  const { data: cats = [] } = useCategories()
  const link = ({ isActive }: { isActive: boolean }) =>
    cn("relative py-1 after:absolute after:inset-x-0 after:bottom-0 after:h-[1.5px] after:origin-left after:scale-x-0 after:bg-rust after:transition-transform hover:after:scale-x-100", isActive && "after:scale-x-100")
  return (
    <nav className={className} aria-label="Main">
      <NavLink to="/shop" end className={link} onClick={onClick}>Shop all</NavLink>
      {cats.map((c) => <NavLink key={c.id} to={`/shop/${c.id}`} className={link} onClick={onClick}>{c.name}</NavLink>)}
      <NavLink to="/story" className={link} onClick={onClick}>Our story</NavLink>
    </nav>
  )
}

function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  const { count } = useCartTotals()
  const wish = useCart((s) => s.wishlist.length)
  const setOpen = useCart((s) => s.setOpen)
  const { data: me } = useMe()

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 30)
    window.addEventListener("scroll", on, { passive: true })
    return () => window.removeEventListener("scroll", on)
  }, [])

  const badge = (n: number) => n > 0 && (
    <span className="absolute right-0.5 top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-rust px-1 text-[10px] font-bold text-white">{n}</span>
  )
  const icon = "relative grid size-10 place-items-center rounded-full transition-colors hover:bg-sand"

  return (
    <header className={cn("sticky top-0 z-30 bg-background/90 backdrop-blur-md transition-shadow", scrolled && "shadow-[0_1px_0_var(--border)]")}>
      <div className="container-x grid grid-cols-[auto_1fr_auto] items-center py-2.5 md:grid-cols-[1fr_auto_1fr]">
        <button className="grid size-10 place-items-center md:hidden" aria-label="Menu" onClick={() => setMenu(true)}><Menu className="size-5" /></button>
        <NavLinks className="hidden gap-7 text-sm font-medium md:flex" />
        <Link to="/" className="justify-self-center" aria-label="Raga Boutique home">
          <img src="/brand/logo-sm.png" alt="Raga — The Music of Colours" className={cn("w-auto transition-[height]", scrolled ? "h-10" : "h-11 md:h-[52px]")} />
        </Link>
        <div className="flex items-center justify-end gap-1">
          {me?.is_admin && <Link to="/admin" className="mr-1 hidden rounded-full bg-marigold px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-cocoa md:block">Admin</Link>}
          <Link to="/account" className={icon} aria-label="Account">
            <User className="size-5" strokeWidth={1.6} />
            {me && <span className="absolute right-2 top-2 size-2 rounded-full bg-emerald-600" />}
          </Link>
          <Link to="/wishlist" className={cn(icon, "max-sm:hidden")} aria-label="Wishlist"><Heart className="size-5" strokeWidth={1.6} />{badge(wish)}</Link>
          <button className={icon} aria-label="Bag" onClick={() => setOpen(true)}><ShoppingBag className="size-5" strokeWidth={1.6} />{badge(count)}</button>
        </div>
      </div>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="bg-background px-6 pt-16">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
          <NavLinks className="flex flex-col gap-1 font-heading text-3xl text-cocoa [&>a]:border-b [&>a]:py-2" onClick={() => setMenu(false)} />
          <div className="mt-4 flex flex-col gap-2 text-lg">
            <Link to="/account" onClick={() => setMenu(false)}>My account</Link>
            <Link to="/wishlist" onClick={() => setMenu(false)}>Wishlist</Link>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}

function Footer() {
  const { data: cats = [] } = useCategories()
  const a = "block py-1 text-sm opacity-80 hover:text-marigold hover:opacity-100"
  return (
    <footer className="mt-20 bg-cocoa px-4 pb-7 pt-16 text-sand sm:px-8 lg:mt-36 lg:px-14">
      <div className="mx-auto grid max-w-[1320px] gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_.8fr_.8fr_1.4fr]">
        <div>
          <img src="/brand/logo-sm.png" alt="Raga" className="mb-4 w-[170px] brightness-0 invert-[.9] sepia-[.3]" />
          <p className="max-w-[34ch] text-sm opacity-80">Handwoven sarees and ethnic wear, chosen the way you'd choose a song: by the mood it leaves you in.</p>
        </div>
        <div>
          <h4 className="mb-3 font-heading text-lg text-background">Shop</h4>
          {cats.map((c) => <Link key={c.id} to={`/shop/${c.id}`} className={a}>{c.name}</Link>)}
          <Link to="/shop?mood=bridal" className={a}>Bridal</Link>
          <Link to="/shop" className={a}>All pieces</Link>
        </div>
        <div>
          <h4 className="mb-3 font-heading text-lg text-background">Help</h4>
          <Link to="/account" className={a}>My orders</Link>
          <Link to="/story" className={a}>Our story</Link>
          <Link to="/story" className={a}>Shipping &amp; returns</Link>
          <Link to="/story" className={a}>Contact</Link>
        </div>
        <div>
          <h4 className="mb-3 font-heading text-lg text-background">Letters from the loom</h4>
          <p className="text-sm opacity-80">New weaves, one short letter a month.</p>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-[1320px] flex-col justify-between gap-1.5 border-t border-sand/15 pt-5 text-xs opacity-65 sm:flex-row">
        <span>© 2026 Raga Boutique</span><span>Made in India, with patience.</span>
      </div>
    </footer>
  )
}

export function StoreLayout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="overflow-hidden whitespace-nowrap bg-cocoa text-xs tracking-wide text-sand">
        <div className="inline-flex animate-[marquee_38s_linear_infinite] py-2.5">
          {[...PROMOS, ...PROMOS].map((t, i) => (
            <span key={i} aria-hidden={i >= PROMOS.length} className="px-8 after:ml-8 after:text-[9px] after:text-marigold after:content-['✦']">{t}</span>
          ))}
        </div>
      </div>
      <Header />
      <main><Outlet /></main>
      <Footer />
      <CartSheet />
      <LoginDialog />
    </div>
  )
}
