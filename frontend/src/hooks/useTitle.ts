import { useEffect } from "react"

const SITE = "Raga Boutique"

export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : `${SITE} | Silk Sarees & Ethnic Wear in Tiruchengode`
  }, [title])
}
