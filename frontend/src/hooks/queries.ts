import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { Address, Category, OrderDetail, OrderSummary, Product, ProductDetail, StoreSettings, User } from "@/lib/types"

export const keys = {
  me: ["me"] as const,
  categories: ["categories"] as const,
  products: (q = "") => ["products", q] as const,
  product: (slug: string) => ["product", slug] as const,
  settings: ["settings"] as const,
  myOrders: ["my-orders"] as const,
  myOrder: (no: string) => ["my-order", no] as const,
  addresses: ["addresses"] as const,
}

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api<User | null>("/api/auth/me"), staleTime: 60_000 })
export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: () => api<Category[]>("/api/categories"), staleTime: 300_000 })
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: () => api<StoreSettings>("/api/settings"), staleTime: 300_000 })

export function useProducts(params: { cat?: string; mood?: string; sort?: string } = {}) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString()
  return useQuery({ queryKey: keys.products(q), queryFn: () => api<Product[]>(`/api/products${q ? "?" + q : ""}`) })
}

export const useProduct = (slug: string) =>
  useQuery({ queryKey: keys.product(slug), queryFn: () => api<ProductDetail>(`/api/products/${slug}`), retry: false })

export const useMyOrders = (enabled: boolean) =>
  useQuery({ queryKey: keys.myOrders, queryFn: () => api<OrderSummary[]>("/api/me/orders"), enabled, refetchInterval: 20_000 })

export const useMyOrder = (orderNo: string, enabled: boolean) =>
  useQuery({ queryKey: keys.myOrder(orderNo), queryFn: () => api<OrderDetail>(`/api/me/orders/${orderNo}`), enabled, retry: false, refetchInterval: 15_000 })

export const useAddresses = (enabled: boolean) =>
  useQuery({ queryKey: keys.addresses, queryFn: () => api<Address[]>("/api/me/addresses"), enabled })
