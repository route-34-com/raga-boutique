import { Heart, Mail, MapPin, Menu, MessageCircle, Phone, Search, ShoppingBag, User } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"

import { FacebookIcon, InstagramIcon } from "@/components/common/BrandIcons"
import { CartSheet, useCartTotals } from "@/components/store/CartSheet"
import { LoginDialog } from "@/components/store/LoginDialog"
import { SearchDialog } from "@/components/store/SearchDialog"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useCategories, useMe, useSettings } from "@/hooks/queries"
import { fmtPhone, inr, waLink } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useCart } from "@/stores/cart"

function usePromos() {
  const { data: s } = useSettings()
  return [
    s ? `Free shipping across India above ${inr(s.free_ship_above)}` : "Free shipping across India",
    "Fall, pico & blouse stitching on request",
    "Silk Mark certified weaves",
    "Video-call shopping on WhatsApp",
  ]
}

function NavLinks({ className, onClick }: { className?: string; onClick?: () => void }) {
  const { data: cats = [] } = useCategories()
  const link = ({ isActive }: { isActive: boolean }) =>
    cn("relative whitespace-nowrap py-1 after:absolute after:inset-x-0 after:bottom-0 after:h-[1.5px] after:origin-left after:scale-x-0 after:bg-rust after:transition-transform hover:after:scale-x-100", isActive && "after:scale-x-100")
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
  const [search, setSearch] = useState(false)
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
      <div className="container-x grid grid-cols-[1fr_auto_1fr] items-center py-2.5">
        <button className="-ml-2 grid size-10 place-items-center justify-self-start lg:hidden" aria-label="Menu" onClick={() => setMenu(true)}><Menu className="size-5" /></button>
        <Link to="/" className="hidden justify-self-start lg:block" aria-label="Raga Boutique home">
          <img src="/brand/logo-sm.png" alt="Raga — The Music of Colours" className={cn("w-auto transition-[height]", scrolled ? "h-10" : "h-12")} />
        </Link>
        <NavLinks className="hidden items-center gap-6 py-2.5 text-[15px] font-medium lg:flex xl:gap-10" />
        {/* Small screens: logo centred between the menu button and the icons. Desktop: logo on the left (above). */}
        <Link to="/" className="justify-self-center px-2 lg:hidden" aria-label="Raga Boutique home">
          <img src="/brand/logo-sm.png" alt="Raga — The Music of Colours" className={cn("w-auto transition-[height]", scrolled ? "h-10" : "h-11 md:h-[52px]")} />
        </Link>
        <div className="flex items-center justify-end gap-1">
          {me?.is_admin && <Link to="/admin" className="mr-1 hidden rounded-full bg-marigold px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-cocoa xl:block">Admin</Link>}
          <button className={icon} aria-label="Search" onClick={() => setSearch(true)}><Search className="size-5" strokeWidth={1.6} /></button>
          <Link to="/account" className={cn(icon, "max-sm:hidden")} aria-label="Account">
            <User className="size-5" strokeWidth={1.6} />
            {me && <span className="absolute right-2 top-2 size-2 rounded-full bg-emerald-600" />}
          </Link>
          <Link to="/wishlist" className={cn(icon, "max-sm:hidden")} aria-label="Wishlist"><Heart className="size-5" strokeWidth={1.6} />{badge(wish)}</Link>
          <button className={icon} aria-label="Bag" onClick={() => setOpen(true)}><ShoppingBag className="size-5" strokeWidth={1.6} />{badge(count)}</button>
        </div>
      </div>
      <SearchDialog open={search} onOpenChange={setSearch} />
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="bg-background px-6 pt-16">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
          <NavLinks className="flex flex-col gap-1 font-heading text-3xl text-cocoa [&>a]:border-b [&>a]:py-2" onClick={() => setMenu(false)} />
          <div className="mt-6 flex flex-col gap-3 text-lg">
            <Link to="/account" onClick={() => setMenu(false)}>My account</Link>
            <Link to="/wishlist" onClick={() => setMenu(false)}>Wishlist</Link>
            <Link to="/story#contact" onClick={() => setMenu(false)}>Contact us</Link>
            {me?.is_admin && <Link to="/admin" onClick={() => setMenu(false)}>Store admin</Link>}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}

export function ContactList({ className, linkClass }: { className?: string; linkClass?: string }) {
  const { data: s } = useSettings()
  if (!s) return null
  const row = cn("flex items-start gap-2.5", linkClass)
  return (
    <ul className={cn("space-y-2.5 text-sm", className)}>
      {s.contact_whatsapp && <li><a className={row} href={waLink(s.contact_whatsapp, "Hi Raga Boutique,")} target="_blank" rel="noopener"><MessageCircle className="mt-0.5 size-4 shrink-0" />WhatsApp {fmtPhone(s.contact_whatsapp)}</a></li>}
      {s.contact_phone && <li><a className={row} href={`tel:+91${s.contact_phone}`}><Phone className="mt-0.5 size-4 shrink-0" />Call {fmtPhone(s.contact_phone)}</a></li>}
      {s.contact_email && <li><a className={row} href={`mailto:${s.contact_email}`}><Mail className="mt-0.5 size-4 shrink-0" />{s.contact_email}</a></li>}
      {s.contact_address && (
        <li>
          <a className={row} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Raga Boutique, " + s.contact_address)}`} target="_blank" rel="noopener">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span>{s.contact_address}{s.contact_hours && <><br />{s.contact_hours}</>}<br /><span className="underline underline-offset-2">Get directions</span></span>
          </a>
        </li>
      )}
    </ul>
  )
}

export function SocialLinks({ className, linkClass }: { className?: string; linkClass?: string }) {
  const { data: s } = useSettings()
  if (!s?.instagram_url && !s?.facebook_url) return null
  const btn = cn("grid size-10 place-items-center rounded-full ring-1 ring-current/25 transition-colors", linkClass)
  return (
    <div className={cn("flex gap-2.5", className)}>
      {s.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener" aria-label="Raga Boutique on Instagram" className={btn}><InstagramIcon className="size-[18px]" /></a>}
      {s.facebook_url && <a href={s.facebook_url} target="_blank" rel="noopener" aria-label="Raga Boutique on Facebook" className={btn}><FacebookIcon className="size-[18px]" /></a>}
    </div>
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
          <SocialLinks className="mt-5" linkClass="hover:bg-sand hover:text-cocoa" />
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
          <Link to="/story#shipping" className={a}>Shipping &amp; returns</Link>
          <Link to="/story#contact" className={a}>Contact</Link>
        </div>
        <div>
          <h4 className="mb-3 font-heading text-lg text-background">Talk to us</h4>
          <ContactList className="opacity-85" linkClass="hover:text-marigold" />
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-[1320px] flex-col justify-between gap-1.5 border-t border-sand/15 pt-5 text-xs opacity-65 sm:flex-row">
        <span>© 2026 Raga Boutique</span><span>Made in India, with patience.</span>
      </div>
    </footer>
  )
}

export function StoreLayout() {
  const { pathname, hash } = useLocation()
  const promos = usePromos()
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }
    // Section links like /story#contact: wait a frame for the page to render, then scroll to it.
    const frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" }))
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])
  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="overflow-hidden whitespace-nowrap bg-cocoa text-xs tracking-wide text-sand">
        <div className="inline-flex animate-[marquee_38s_linear_infinite] py-2.5">
          {[...promos, ...promos].map((t, i) => (
            <span key={i} aria-hidden={i >= promos.length} className="px-8 after:ml-8 after:text-[9px] after:text-marigold after:content-['✦']">{t}</span>
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
