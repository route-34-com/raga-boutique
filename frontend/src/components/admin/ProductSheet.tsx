import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ImagePlus, X } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, api, del, post, put } from "@/lib/api"
import { MOODS, ONE_SIZE } from "@/lib/format"
import type { AdminCategory, AdminProduct } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import { Photo } from "@/components/common/Photo"

const SIZE_SET = ["XS", "S", "M", "L", "XL", "XXL"]
const ATTRS: ["color" | "material" | "work" | "pattern", string, string[]][] = [
  ["color", "Colour", ["Red", "Pink", "Peach", "Orange", "Yellow", "Green", "Teal", "Blue", "Purple", "Lilac", "Ivory", "Black", "Gold", "Maroon"]],
  ["material", "Material", ["Kanjivaram silk", "Banarasi silk", "Tissue silk", "Soft silk", "Cotton", "Linen", "Organza", "Georgette", "Chiffon", "Crepe", "Raw silk"]],
  ["work", "Work", ["Zari", "Zardozi", "Embroidery", "Chikankari", "Gota-patti", "Sequins", "Printed", "Plain"]],
  ["pattern", "Pattern", ["Woven buttis", "Contrast border", "Brocade", "Floral", "Paisley", "Checks", "Stripes", "Solid"]],
]
const OCCASIONS = ["Wedding", "Engagement", "Reception", "Festive", "Pooja", "Haldi", "Mehendi", "Sangeet", "Party", "Office", "Casual"]

// Phone photos are often 5-12 MB and the host caps uploads at 4.5 MB, so shrink in the browser first.
// The server resizes to 1600px anyway; this just does it before the upload instead of after.
async function shrinkPhoto(file: File, maxSide = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88))
    return blob ?? file
  } catch {
    return file // formats the browser can't decode (e.g. some HEIC) go up as-is; the server explains if it can't read them
  }
}

type Draft = {
  name: string; raga: string; category_id: string; mood: string; price: string; mrp: string; tag: string; swatch: string
  raga_note: string; details: string; care: string; active: boolean; sized: boolean
  color: string; material: string; work: string; pattern: string; occasions: string[]
  stock: Record<string, number>; sizes: string[]; images: { url: string; uploading?: boolean }[]
}

function toDraft(p: AdminProduct | null, firstCat: string): Draft {
  if (!p) return { name: "", raga: "", category_id: firstCat, mood: "festive", price: "", mrp: "", tag: "", swatch: "#c08040",
    raga_note: "", details: "", care: "", active: true, sized: false, stock: { [ONE_SIZE]: 1 }, sizes: [], images: [],
    color: "", material: "", work: "", pattern: "", occasions: [] }
  const sized = p.variants.some((v) => v.size !== ONE_SIZE)
  return {
    name: p.name, raga: p.raga, category_id: p.category_id, mood: p.mood, price: String(p.price), mrp: p.mrp ? String(p.mrp) : "",
    tag: p.tag, swatch: p.swatch, raga_note: p.raga_note, details: p.details.join("\n"), care: p.care, active: p.active, sized,
    color: p.color, material: p.material, work: p.work, pattern: p.pattern, occasions: p.occasions,
    stock: Object.fromEntries(p.variants.map((v) => [v.size, v.stock])), sizes: sized ? p.variants.map((v) => v.size) : [],
    images: p.images.map((i) => ({ url: i.url })),
  }
}

export function ProductSheet({ product, isNew, onClose }: { product: AdminProduct | null; isNew: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: cats = [] } = useQuery({ queryKey: ["admin", "categories"], queryFn: () => api<AdminCategory[]>("/api/admin/categories") })
  const [d, setD] = useState<Draft>(() => toDraft(product, cats[0]?.id ?? "sarees"))
  const [error, setErrorText] = useState("")
  const [dragging, setDragging] = useState(false)
  const errorRef = useRef<HTMLParagraphElement>(null)
  // The message sits at the bottom of a long form, so bring it into view and toast it too.
  const setError = (msg: string) => {
    setErrorText(msg)
    if (!msg) return
    toast.error(msg)
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }))
  }
  const set =<K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const open = isNew || product !== null

  async function upload(files: FileList) {
    for (const file of Array.from(files)) {
      const slot = { url: URL.createObjectURL(file), uploading: true }
      setD((x) => ({ ...x, images: [...x.images, slot] }))
      const form = new FormData()
      form.append("file", await shrinkPhoto(file), "photo.jpg")
      try {
        const { url } = await api<{ url: string }>("/api/admin/products/upload", { method: "POST", body: form })
        setD((x) => ({ ...x, images: x.images.map((i) => (i === slot ? { url } : i)) }))
      } catch (e) {
        setD((x) => ({ ...x, images: x.images.filter((i) => i !== slot) }))
        toast.error(e instanceof ApiError ? e.message : "Upload failed.")
      }
    }
  }

  const save = useMutation({
    mutationFn: () => {
      const variants = d.sized
        ? d.sizes.map((s) => ({ size: s, stock: d.stock[s] ?? 0 }))
        : [{ size: ONE_SIZE, stock: d.stock[ONE_SIZE] ?? 0 }]
      const body = {
        name: d.name, raga: d.raga, category_id: d.category_id, mood: d.mood, price: Number(d.price), mrp: d.mrp ? Number(d.mrp) : null,
        tag: d.tag, swatch: d.swatch, raga_note: d.raga_note, care: d.care, active: d.active,
        color: d.color, material: d.material, work: d.work, pattern: d.pattern, occasions: d.occasions,
        details: d.details.split("\n").map((s) => s.trim()).filter(Boolean), variants, images: d.images.map((i) => i.url),
      }
      return isNew ? post<AdminProduct>("/api/admin/products", body) : put<AdminProduct>(`/api/admin/products/${product!.id}`, body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Product saved."); onClose() },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't save. Please try again."),
  })

  const remove = useMutation({
    mutationFn: () => del(`/api/admin/products/${product!.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["products"] }); toast("Product deleted."); onClose() },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (d.images.some((i) => i.uploading)) return setError("Wait for photos to finish uploading.")
    if (!d.images.length) return setError("Add at least one photo.")
    if (d.sized && !d.sizes.length) return setError("Pick at least one size, or turn off “comes in sizes”.")
    if (d.mrp && Number(d.mrp) < Number(d.price)) return setError("MRP should be higher than the selling price (or leave it empty).")
    save.mutate()
  }

  const field = "grid gap-1.5"
  const card = "grid gap-4 rounded-2xl border bg-white/70 p-5"
  const hint = "-mt-2 text-xs text-muted-foreground"
  const off = d.mrp && Number(d.mrp) > Number(d.price) && Number(d.price) > 0 ? Math.round((1 - Number(d.price) / Number(d.mrp)) * 100) : 0
  const picker = (
    <input type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = "" }} />
  )
  const drop = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragging(true) },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files) },
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-6xl">
        <DialogHeader className="gap-1 border-b px-6 py-5">
          <p className="eyebrow">{isNew ? "New product" : "Edit product"}</p>
          <div className="flex flex-wrap items-center gap-3 pr-8">
            <DialogTitle className={cn("font-heading text-[26px] font-normal leading-tight", d.name ? "text-cocoa" : "text-muted-foreground")}>
              {d.name || (isNew ? "Name your piece" : "Untitled")}
            </DialogTitle>
            {!isNew && <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", d.active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground")}>{d.active ? "On store" : "Hidden"}</span>}
          </div>
          <DialogDescription>{isNew ? "Add photos and the basics, set the stock, then save. Everything else can be filled in later." : "Changes go live when you press Save."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col text-sm">
          <div className="grid flex-1 items-start gap-5 overflow-y-auto bg-[#f7f1e8] p-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="grid gap-5 lg:sticky lg:top-0">
              <section className={card}>
                <div><h4 className="eyebrow">Photos</h4><p className="mt-1 text-xs text-muted-foreground">The first photo is the cover. Use ← to move a photo earlier. Large photos are shrunk automatically.</p></div>
                {d.images.length === 0 ? (
                  <label {...drop} className={cn("grid cursor-pointer place-items-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#d2bfa6] px-4 py-10 text-center transition-colors hover:bg-[#fdf3e2]", dragging && "border-rust bg-[#fdf3e2]")}>
                    <span className="grid size-12 place-items-center rounded-full bg-[#fdf3e2] text-rust"><ImagePlus className="size-6" /></span>
                    <span className="font-semibold text-cocoa">Drag photos here, or click to choose</span>
                    <span className="text-xs text-muted-foreground">JPG or PNG from your phone or camera. Add a few angles and a close-up of the work.</span>
                    {picker}
                  </label>
                ) : (
                  <div {...drop} className={cn("grid grid-cols-3 gap-2 rounded-xl sm:grid-cols-4 lg:grid-cols-3", dragging && "ring-2 ring-rust ring-offset-4 ring-offset-white")}>
                    {d.images.map((im, i) => (
                      <figure key={im.url} className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
                        <Photo src={im.url} alt="" className={cn("size-full object-cover", im.uploading && "opacity-50")} />
                        {im.uploading && <span className="absolute inset-0 grid place-items-center"><Spinner aria-label="Uploading" className="size-6 text-cocoa" /></span>}
                        {i === 0 ? <span className="absolute bottom-1.5 left-1.5 rounded bg-cocoa px-2 py-0.5 text-[10px] font-bold text-white">Cover</span>
                          : <button type="button" aria-label="Move earlier" onClick={() => setD((x) => { const a = [...x.images];[a[i - 1], a[i]] = [a[i], a[i - 1]]; return { ...x, images: a } })}
                            className="absolute bottom-1.5 left-1.5 grid size-7 place-items-center rounded-full bg-white/90"><ArrowLeft className="size-3.5" /></button>}
                        <button type="button" aria-label="Remove photo" onClick={() => set("images", d.images.filter((_, j) => j !== i))}
                          className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-destructive"><X className="size-3.5" /></button>
                      </figure>
                    ))}
                    <label className="grid aspect-[4/5] cursor-pointer place-items-center rounded-lg border-[1.5px] border-dashed border-[#d2bfa6] text-rust hover:bg-[#fdf3e2]">
                      <span className="flex flex-col items-center gap-1 text-xs font-bold"><ImagePlus className="size-5" />Add more</span>
                      {picker}
                    </label>
                  </div>
                )}
              </section>

              <section className={card}>
                <h4 className="eyebrow">Sizes &amp; stock</h4>
                <label className="flex items-center gap-2.5"><Switch checked={d.sized} onCheckedChange={(v) => set("sized", v)} /> This piece comes in sizes</label>
                {d.sized ? (
                  <div className="grid grid-cols-3 gap-2">
                    {SIZE_SET.map((s) => {
                      const on = d.sizes.includes(s)
                      return (
                        <div key={s} className={cn("rounded-lg border bg-white p-2.5", on && "border-cocoa")}>
                          <label className="mb-1.5 flex items-center gap-2 font-bold">
                            <Checkbox checked={on} onCheckedChange={(v) => set("sizes", v ? SIZE_SET.filter((x) => x === s || d.sizes.includes(x)) : d.sizes.filter((x) => x !== s))} />{s}
                          </label>
                          <Input type="number" min={0} disabled={!on} aria-label={`Stock for ${s}`} value={d.stock[s] ?? 0}
                            onChange={(e) => set("stock", { ...d.stock, [s]: Math.max(0, Number(e.target.value)) })} className="h-8" />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className={cn(field, "max-w-48")}><Label htmlFor="p-stock">Pieces in stock</Label>
                    <Input id="p-stock" type="number" min={0} value={d.stock[ONE_SIZE] ?? 0} onChange={(e) => set("stock", { ...d.stock, [ONE_SIZE]: Math.max(0, Number(e.target.value)) })} /></div>
                )}
              </section>

              <section className={cn(card, "grid-cols-[1fr_auto] items-center")}>
                <div><h4 className="eyebrow">Show on store</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{d.active ? "Shoppers can see and buy this piece." : "Hidden from shoppers. Only admins can see it."}</p></div>
                <Switch checked={d.active} onCheckedChange={(v) => set("active", v)} aria-label="Show on store" />
              </section>
            </div>

            <div className="grid gap-5">
              <section className={card}>
                <h4 className="eyebrow">Basics</h4>
                <div className={field}><Label htmlFor="p-name">Product name</Label><Input id="p-name" required value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Peach Tissue Silk Saree" /></div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className={field}><Label htmlFor="p-raga">Raga name</Label><Input id="p-raga" value={d.raga} onChange={(e) => set("raga", e.target.value)} placeholder="e.g. Bhairavi" /></div>
                  <div className={field}><Label>Mood</Label>
                    <Select value={d.mood} onValueChange={(v) => set("mood", v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(MOODS).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}</SelectContent></Select></div>
                  <div className={field}><Label>Category</Label>
                    <Select value={d.category_id} onValueChange={(v) => set("category_id", v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className={field}><Label htmlFor="p-tag">Badge (optional)</Label><Input id="p-tag" value={d.tag} onChange={(e) => set("tag", e.target.value)} placeholder="New, Bestseller…" /></div>
                </div>
              </section>

              <section className={card}>
                <h4 className="eyebrow">Price</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_120px]">
                  <div className={field}><Label htmlFor="p-price">Selling price (₹)</Label><Input id="p-price" type="number" min={1} required value={d.price} placeholder="e.g. 7450" onChange={(e) => set("price", e.target.value)} /></div>
                  <div className={field}><Label htmlFor="p-mrp">MRP (₹)</Label><Input id="p-mrp" type="number" min={0} value={d.mrp} placeholder="Optional" onChange={(e) => set("mrp", e.target.value)} /></div>
                  <div className={cn(field, "max-sm:col-span-2")}><Label htmlFor="p-swatch">Swatch colour</Label><Input id="p-swatch" type="color" value={d.swatch} onChange={(e) => set("swatch", e.target.value)} className="p-1" /></div>
                </div>
                <p className={hint}>
                  {off ? <span className="font-semibold text-emerald-700">Shoppers see {off}% off. </span> : null}
                  MRP shows struck through next to the selling price and must be higher than it. The swatch is the dot shown beside the name.
                </p>
              </section>

              <section className={card}>
                <div><h4 className="eyebrow">Shop filters</h4><p className="mt-1 text-xs text-muted-foreground">Shoppers filter the collection by these. Pick a suggestion or type your own.</p></div>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {ATTRS.map(([k, label, hints]) => (
                    <div key={k} className={field}><Label htmlFor={`p-${k}`}>{label}</Label>
                      <Input id={`p-${k}`} list={`hints-${k}`} value={d[k]} maxLength={40} onChange={(e) => set(k, e.target.value)} placeholder={hints[0]} />
                      <datalist id={`hints-${k}`}>{hints.map((h) => <option key={h} value={h} />)}</datalist></div>
                  ))}
                </div>
                <div className={field}><Label>Occasions</Label>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set([...OCCASIONS, ...d.occasions])].map((o) => {
                      const on = d.occasions.includes(o)
                      return <button key={o} type="button" aria-pressed={on} onClick={() => set("occasions", on ? d.occasions.filter((x) => x !== o) : [...d.occasions, o])}
                        className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1 transition", on ? "bg-cocoa text-background ring-cocoa" : "bg-white ring-border hover:ring-cocoa")}>{o}</button>
                    })}
                  </div>
                </div>
              </section>

              <section className={card}>
                <h4 className="eyebrow">Story &amp; details</h4>
                <div className={field}><Label htmlFor="p-note">Raga note (shown on the product page)</Label><Textarea id="p-note" rows={4} value={d.raga_note} onChange={(e) => set("raga_note", e.target.value)} placeholder="What this piece feels like, and why it's named for its raga." /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={field}><Label htmlFor="p-details">Details (one per line)</Label><Textarea id="p-details" rows={4} value={d.details} onChange={(e) => set("details", e.target.value)} placeholder={"Fabric and weave\nBorder and pallu\nBlouse piece\nLength"} /></div>
                  <div className={field}><Label htmlFor="p-care">Care</Label><Textarea id="p-care" rows={4} value={d.care} onChange={(e) => set("care", e.target.value)} placeholder="e.g. Dry clean only." /></div>
                </div>
              </section>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 border-t bg-card px-6 py-4">
            {!isNew && <Button type="button" variant="destructive" className="h-10 px-4" disabled={remove.isPending}
              onClick={() => confirm(`Delete “${product!.name}” permanently? Past orders keep their copy. To hide it for now, turn off “Show on store” instead.`) && remove.mutate()}>{remove.isPending && <Spinner />}Delete</Button>}
            {error && <p ref={errorRef} role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}
            <div className="ml-auto flex gap-2.5">
              <Button type="button" variant="ghost" className="h-10 px-4" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="h-10 px-5" disabled={save.isPending}>{save.isPending ? <><Spinner />Saving…</> : isNew ? "Add product" : "Save changes"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
