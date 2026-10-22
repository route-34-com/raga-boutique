import { Link, useNavigate } from "react-router"
import { toast } from "sonner"

import { QtyStepper } from "@/components/common/QtyStepper"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useProducts, useSettings } from "@/hooks/queries"
import { cover, inr, stockOf } from "@/lib/format"
import { useCart } from "@/stores/cart"

export function useCartTotals() {
  const lines = useCart((s) => s.lines)
  const { data: products = [] } = useProducts()
  const { data: settings } = useSettings()
  const rows = lines
    .map((l) => ({ ...l, product: products.find((p) => p.id === l.productId) }))
    .filter((r) => r.product)
  const subtotal = rows.reduce((n, r) => n + r.product!.price * r.qty, 0)
  const freeAbove = settings?.free_ship_above ?? 5000
  const shipping = !rows.length || subtotal >= freeAbove ? 0 : settings?.ship_fee ?? 150
  return { rows, subtotal, shipping, total: subtotal + shipping, freeAbove, count: rows.reduce((n, r) => n + r.qty, 0) }
}

export function CartSheet() {
  const { open, setOpen, setQty } = useCart()
  const { rows, subtotal, freeAbove } = useCartTotals()
  const navigate = useNavigate()
  const left = freeAbove - subtotal

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 bg-background p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="font-heading text-2xl font-normal text-cocoa">Your bag</SheetTitle>
          <SheetDescription className="sr-only">Items you're about to order</SheetDescription>
        </SheetHeader>
        {!rows.length ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
            <p className="font-heading text-xl italic text-rust">Your bag is quiet.</p>
            <Button className="h-11 rounded-full px-6" onClick={() => { setOpen(false); navigate("/shop") }}>Find a piece</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 divide-y overflow-y-auto px-6">
              {rows.map(({ product: p, size, qty, productId }) => {
                const max = stockOf(p!, size)
                return (
                  <div key={`${productId}-${size}`} className="grid grid-cols-[76px_1fr_auto] gap-3.5 py-4">
                    <Link to={`/p/${p!.slug}`} onClick={() => setOpen(false)}>
                      <img src={cover(p!)} alt="" className="aspect-[4/5] w-[76px] rounded-xl object-cover" />
                    </Link>
                    <div className="flex min-w-0 flex-col items-start text-sm">
                      <span className="eyebrow text-[10px]">Raag {p!.raga}</span>
                      <Link to={`/p/${p!.slug}`} onClick={() => setOpen(false)} className="font-heading text-base leading-snug text-cocoa">{p!.name}</Link>
                      {size && <span className="text-muted-foreground">Size {size}</span>}
                      <div className="mt-2">
                        <QtyStepper size="sm" value={qty} min={0} max={max}
                          onChange={(n) => { if (n > max) return toast(`Only ${max} in stock.`); setQty(productId, size, n) }} />
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between text-sm">
                      <strong>{inr(p!.price * qty)}</strong>
                      <button className="text-xs text-muted-foreground underline" onClick={() => setQty(productId, size, 0)}>Remove</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <SheetFooter className="gap-3 border-t px-6 py-5">
              <div className="h-1 overflow-hidden rounded bg-sand">
                <div className="h-full bg-marigold transition-[width] duration-500" style={{ width: `${Math.min(100, (subtotal / freeAbove) * 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{left > 0 ? `Add ${inr(left)} more for free shipping.` : "You've unlocked free shipping."}</p>
              <div className="flex justify-between text-base"><span>Subtotal</span><strong>{inr(subtotal)}</strong></div>
              <Button className="h-12 rounded-full" onClick={() => { setOpen(false); navigate("/checkout") }}>Checkout</Button>
              <p className="text-center text-[13px] text-muted-foreground">Your bag is kept in this tab only. Closing the tab clears it.</p>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
