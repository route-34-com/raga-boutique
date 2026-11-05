import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export function PageLoader({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div aria-live="polite" className={cn("grid min-h-[60vh] place-items-center", className)}>
      <div className="flex flex-col items-center gap-4">
        <img src="/brand/logo-sm.png" alt="" className="h-12 w-auto animate-pulse opacity-80" />
        <Spinner aria-label={label} className="size-6 text-rust" />
      </div>
    </div>
  )
}
