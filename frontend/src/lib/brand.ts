import { useEffect } from "react"

import { useSettings } from "@/hooks/queries"

export type Brand = "plum" | "cocoa"

export const BRANDS: Record<Brand, { label: string; note: string; ink: string; logo: string; icon: string; iconType: string; touch: string }> = {
  plum: { label: "Plum", note: "The colour of the Instagram logo", ink: "#732853", logo: "/brand/logo-plum.png",
    icon: "/brand/favicon-plum.png", iconType: "image/png", touch: "/brand/apple-touch-icon-plum.png" },
  cocoa: { label: "Cocoa", note: "The original deep brown", ink: "#3d1d0f", logo: "/brand/logo-sm.png",
    icon: "/brand/favicon.svg", iconType: "image/svg+xml", touch: "/brand/apple-touch-icon.png" },
}

const KEY = "raga-brand"

export const isBrand = (v: unknown): v is Brand => v === "plum" || v === "cocoa"

export function currentBrand(): Brand {
  const v = document.documentElement.dataset.brand
  return isBrand(v) ? v : "plum"
}

export function applyBrand(brand: Brand) {
  const root = document.documentElement
  if (root.dataset.brand !== brand) root.dataset.brand = brand
  const b = BRANDS[brand]
  const icon = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (icon && icon.getAttribute("href") !== b.icon) { icon.href = b.icon; icon.type = b.iconType }
  const touch = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']")
  if (touch && touch.getAttribute("href") !== b.touch) touch.href = b.touch
  try { localStorage.setItem(KEY, brand) } catch { /* private mode: the store's setting still applies on every load */ }
}

export function useBrand(): Brand {
  const { data } = useSettings()
  return isBrand(data?.brand_theme) ? data.brand_theme : currentBrand()
}

export const useLogo = () => BRANDS[useBrand()].logo

export function useBrandSync() {
  const brand = useSettings().data?.brand_theme
  useEffect(() => { if (isBrand(brand)) applyBrand(brand) }, [brand])
}
