import { inr } from "@/lib/format"

export const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7)
export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
export const monthLabel = (m: string, short = false) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: short ? "short" : "long", year: short ? "2-digit" : "numeric" })
export const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
export const signed = (n: number) => (n < 0 ? `−${inr(-n)}` : inr(n))

export function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split("-").map(Number)
  const d = new Date(y, mo - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
