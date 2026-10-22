import type { OrderStatus, Product } from "@/lib/types"

export const ONE_SIZE = "ONE"

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN")

// "+919876500011" or "9876500011" → "+91 98765 00011"
export function fmtPhone(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "")
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : phone
}

export const waLink = (mobile: string, text = "") =>
  `https://wa.me/91${mobile.replace(/\D/g, "").slice(-10)}${text ? `?text=${encodeURIComponent(text)}` : ""}`

export const fmtDate = (iso: string, withTime = false) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  })

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Order placed",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
}
export const FLOW: OrderStatus[] = ["placed", "confirmed", "packed", "shipped", "delivered"]
export const ONGOING: OrderStatus[] = ["placed", "confirmed", "packed", "shipped"]

// Indian classical music gives each raga a time of day and a feeling; we do the same with colour.
export const MOODS: Record<string, { label: string; note: string }> = {
  dawn: { label: "Dawn", note: "Morning ragas — soft light, quiet gold" },
  festive: { label: "Festive", note: "Spring ragas — marigold and celebration" },
  dusk: { label: "Dusk", note: "Evening ragas — deep, glowing, grown-up" },
  bridal: { label: "Bridal", note: "Auspicious ragas — for the day itself" },
  night: { label: "Night", note: "Late ragas — pale, calm, moonlit" },
  monsoon: { label: "Monsoon", note: "Rain ragas — cool, swirling, light" },
}

export const stockOf = (p: Product, size: string | null) =>
  p.variants.find((v) => v.size === (size ?? ONE_SIZE))?.stock ?? 0

export const isSized = (p: Product) => p.variants.some((v) => v.size !== ONE_SIZE)

export const cover = (p: { images: { url: string }[] }, i = 0) =>
  p.images[i]?.url ?? p.images[0]?.url ?? "/brand/logo-sm.png"
