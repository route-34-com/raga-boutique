import { ArrowRight, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useProducts } from "@/hooks/queries"
import { cover, inr } from "@/lib/format"

const SUGGESTIONS = ["Kanjivaram", "Banarasi", "Bridal", "Lehenga", "Tissue", "Festive"]

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate()
  const [text, setText] = useState("")
  const [q, setQ] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250)
    return () => clearTimeout(t)
  }, [text])
  const { data: results = [], isFetching } = useProducts({ q }, q.length >= 2)
  const close = () => { onOpenChange(false); setText(""); setQ("") }

  function seeAll(term = text.trim()) {
    if (!term) return
    close()
    navigate(`/shop?q=${encodeURIComponent(term)}`)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="top-[12%] translate-y-0 gap-0 bg-background p-0 sm:max-w-[560px]">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Search sarees, lehengas and more by name, raga, colour or mood</DialogDescription>
        <form onSubmit={(e) => { e.preventDefault(); seeAll() }} className="flex items-center gap-3 border-b px-5 py-4">
          <Search className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.6} />
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Search sarees, lehengas, colours, ragas…"
            aria-label="Search" maxLength={80} className="h-9 flex-1 bg-transparent pr-8 text-base outline-none placeholder:text-muted-foreground" />
        </form>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {q.length < 2 ? (
            <div className="p-3">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Try</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => setText(s)} className="rounded-full bg-paper px-4 py-1.5 text-sm ring-1 ring-border hover:ring-cocoa">{s}</button>
                ))}
              </div>
            </div>
          ) : results.length ? (
            <>
              {results.slice(0, 6).map((p) => (
                <Link key={p.id} to={`/p/${p.slug}`} onClick={close} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 hover:bg-paper">
                  <img src={cover(p)} alt="" className="aspect-[4/5] w-11 rounded-md object-cover" />
                  <span><span className="block font-medium">{p.name}</span><span className="text-xs text-muted-foreground">Raag {p.raga}</span></span>
                  <span className="text-sm">{inr(p.price)}</span>
                </Link>
              ))}
              <button type="button" onClick={() => seeAll(q)} className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-rust hover:bg-paper">
                See all {results.length} {results.length === 1 ? "result" : "results"} <ArrowRight className="size-4" />
              </button>
            </>
          ) : (
            <p className="px-3 py-8 text-center text-muted-foreground">{isFetching ? "Searching…" : <>Nothing matches “{q}”. Try a colour, a fabric or a raga.</>}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
