import { create } from "zustand"
import { persist, type PersistStorage } from "zustand/middleware"

export type CartLine = { productId: number; slug: string; size: string | null; qty: number }

type CartState = {
  lines: CartLine[]
  wishlist: number[]
  open: boolean
  setOpen: (open: boolean) => void
  add: (line: CartLine) => void
  setQty: (productId: number, size: string | null, qty: number) => void
  clear: () => void
  toggleWish: (productId: number) => boolean
}

type Saved = { lines: CartLine[]; wishlist: number[] }

// The bag lives in this tab only (sessionStorage: survives reloads, not closing the tab).
// The wishlist stays in localStorage, across visits.
function read<T>(store: Storage, key: string, fallback: T): T {
  try { return JSON.parse(store.getItem(key) ?? "null") ?? fallback } catch { return fallback }
}
function write(store: Storage, key: string, value: unknown) {
  try { store.setItem(key, JSON.stringify(value)) } catch { /* private mode or full: keep it in memory */ }
}
const splitStorage: PersistStorage<Saved> = {
  getItem: () => ({ state: { lines: read(sessionStorage, "raga-bag", []), wishlist: read(localStorage, "raga-wishlist", []) } }),
  setItem: (_, { state }) => { write(sessionStorage, "raga-bag", state.lines); write(localStorage, "raga-wishlist", state.wishlist) },
  removeItem: () => { sessionStorage.removeItem("raga-bag"); localStorage.removeItem("raga-wishlist") },
}

const same = (a: CartLine, productId: number, size: string | null) => a.productId === productId && a.size === size

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      wishlist: [],
      open: false,
      setOpen: (open) => set({ open }),
      add: (line) =>
        set((s) => {
          const found = s.lines.find((l) => same(l, line.productId, line.size))
          return {
            lines: found
              ? s.lines.map((l) => (l === found ? { ...l, qty: l.qty + line.qty } : l))
              : [...s.lines, line],
          }
        }),
      setQty: (productId, size, qty) =>
        set((s) => ({
          lines: qty < 1
            ? s.lines.filter((l) => !same(l, productId, size))
            : s.lines.map((l) => (same(l, productId, size) ? { ...l, qty } : l)),
        })),
      clear: () => set({ lines: [] }),
      toggleWish: (productId) => {
        const on = !get().wishlist.includes(productId)
        set((s) => ({ wishlist: on ? [...s.wishlist, productId] : s.wishlist.filter((id) => id !== productId) }))
        return on
      },
    }),
    { name: "raga-cart", storage: splitStorage, partialize: (s) => ({ lines: s.lines, wishlist: s.wishlist }) },
  ),
)
