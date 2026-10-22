import { Link } from "react-router"

import { ProductCard } from "@/components/store/ProductCard"
import { Button } from "@/components/ui/button"
import { useProducts } from "@/hooks/queries"
import { useTitle } from "@/hooks/useTitle"
import { useCart } from "@/stores/cart"

export default function Wishlist() {
  useTitle("Wishlist")
  const ids = useCart((s) => s.wishlist)
  const { data: products = [] } = useProducts()
  const list = products.filter((p) => ids.includes(p.id))
  return (
    <section className="container-x pt-6 md:pt-10">
      <h1 className="mb-8 text-[clamp(36px,4.6vw,60px)] leading-none">Saved for later</h1>
      {list.length ? <div className="grid grid-cols-2 gap-3 md:gap-7 lg:grid-cols-4">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div> : (
        <div className="flex flex-col items-center gap-5 py-16 text-center">
          <p className="font-heading text-xl italic text-rust">Nothing saved yet. Tap the heart on anything that stays with you.</p>
          <Button asChild className="rounded-full px-6"><Link to="/shop">Browse the edit</Link></Button>
        </div>
      )}
    </section>
  )
}
