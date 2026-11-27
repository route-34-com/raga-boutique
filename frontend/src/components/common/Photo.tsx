import { ImageOff } from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"

type PhotoProps = React.ComponentProps<"img"> & {
  tone?: string
  hideOnError?: boolean
}

const PRODUCT_PHOTO = /^(\/uploads\/products\/[\w-]+)\.jpg$/
const BANNER = /^(\/brand\/[\w-]+)\.webp$/

/** Product photos have 480 and 960px WebP copies, banners a 640px one; the browser picks the smallest that looks sharp. */
function photoSrcSet(src?: string) {
  const m = src?.match(PRODUCT_PHOTO)
  if (m) return `${m[1]}.w480.webp 480w, ${m[1]}.w960.webp 960w, ${src} 1600w`
  const b = src?.match(BANNER)
  return b ? `${b[1]}-640.webp 640w, ${src} 1080w` : undefined
}

export function Photo({ src, alt = "", className, tone, hideOnError, onError, sizes, ...props }: PhotoProps) {
  const [failed, setFailed] = useState<string | undefined>()
  const [plain, setPlain] = useState(false)
  if (src && failed !== src) {
    const srcSet = plain ? undefined : photoSrcSet(src)
    return (
      <img src={src} srcSet={srcSet} sizes={srcSet ? sizes ?? "(min-width: 1024px) 25vw, 50vw" : undefined} alt={alt}
        className={className} {...props}
        onError={(e) => {
          if (srcSet) { setPlain(true); return }
          setFailed(src); onError?.(e)
        }} />
    )
  }
  if (hideOnError) return null
  return (
    <div role="img" aria-label={alt || "Photo not available"} className={cn("@container grid place-items-center overflow-hidden", className)}
      style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${tone ?? "var(--sand)"} 22%, var(--paper)), color-mix(in oklab, ${tone ?? "var(--sand)"} 38%, var(--sand)))` }}>
      <div className="flex flex-col items-center gap-2 px-3 text-center text-cocoa/45">
        <img src="/brand/logo-sm.webp" alt="" className="hidden w-[38%] max-w-28 opacity-40 grayscale @[140px]:block" />
        <ImageOff className="size-4 @[140px]:hidden" strokeWidth={1.6} />
        <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] @[140px]:block">Photo coming soon</span>
      </div>
    </div>
  )
}
