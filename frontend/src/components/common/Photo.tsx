import { ImageOff } from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"

type PhotoProps = React.ComponentProps<"img"> & {
  tone?: string
  hideOnError?: boolean
}

export function Photo({ src, alt = "", className, tone, hideOnError, onError, ...props }: PhotoProps) {
  const [failed, setFailed] = useState<string | undefined>()
  if (src && failed !== src) {
    return <img src={src} alt={alt} className={className} onError={(e) => { setFailed(src); onError?.(e) }} {...props} />
  }
  if (hideOnError) return null
  return (
    <div role="img" aria-label={alt || "Photo not available"} className={cn("@container grid place-items-center overflow-hidden", className)}
      style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${tone ?? "var(--sand)"} 22%, var(--paper)), color-mix(in oklab, ${tone ?? "var(--sand)"} 38%, var(--sand)))` }}>
      <div className="flex flex-col items-center gap-2 px-3 text-center text-cocoa/45">
        <img src="/brand/logo-sm.png" alt="" className="hidden w-[38%] max-w-28 opacity-40 grayscale @[140px]:block" />
        <ImageOff className="size-4 @[140px]:hidden" strokeWidth={1.6} />
        <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] @[140px]:block">Photo coming soon</span>
      </div>
    </div>
  )
}
