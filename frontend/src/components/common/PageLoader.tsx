export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="grid min-h-[60vh] place-items-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/brand/logo-sm.png" alt="" className="h-12 w-auto animate-pulse opacity-80" />
        <span className="size-6 animate-spin rounded-full border-2 border-sand border-t-rust" />
        <span className="sr-only">{label}…</span>
      </div>
    </div>
  )
}
