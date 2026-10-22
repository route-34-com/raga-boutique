import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ImagePlus, X } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, api, del, post, put } from "@/lib/api"
import { MOODS, ONE_SIZE } from "@/lib/format"
import type { AdminCategory, AdminProduct } from "@/lib/types"
import { cn } from "@/lib/utils"

const SIZE_SET = ["XS", "S", "M", "L", "XL", "XXL"]

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
  stock: Record<string, number>; sizes: string[]; images: { url: string; uploading?: boolean }[]
}

function toDraft(p: AdminProduct | null, firstCat: string): Draft {
  if (!p) return { name: "", raga: "", category_id: firstCat, mood: "festive", price: "", mrp: "", tag: "", swatch: "#c08040",
    raga_note: "", details: "", care: "", active: true, sized: false, stock: { [ONE_SIZE]: 1 }, sizes: [], images: [] }
  const sized = p.variants.some((v) => v.size !== ONE_SIZE)
  return {
    name: p.name, raga: p.raga, category_id: p.category_id, mood: p.mood, price: String(p.price), mrp: p.mrp ? String(p.mrp) : "",
    tag: p.tag, swatch: p.swatch, raga_note: p.raga_note, details: p.details.join("\n"), care: p.care, active: p.active, sized,
    stock: Object.fromEntries(p.variants.map((v) => [v.size, v.stock])), sizes: sized ? p.variants.map((v) => v.size) : [],
    images: p.images.map((i) => ({ url: i.url })),
  }
}

export function ProductSheet({ product, isNew, onClose }: { product: AdminProduct | null; isNew: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: cats = [] } = useQuery({ queryKey: ["admin", "categories"], queryFn: () => api<AdminCategory[]>("/api/admin/categories") })
  const [d, setD] = useState<Draft>(() => toDraft(product, cats[0]?.id ?? "sarees"))
  const [error, setErrorText] = useState("")
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
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto bg-card p-0 sm:max-w-[600px]">
        <SheetHeader className="border-b px-6 py-5">
          <p className="eyebrow">{isNew ? "New product" : "Edit product"}</p>
          <SheetTitle className="font-heading text-[26px] font-normal text-cocoa">{d.name || "Untitled"}</SheetTitle>
          <SheetDescription className="sr-only">Product details, photos and stock</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="grid gap-4 px-6 pb-0 pt-5 text-sm">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Photos</h4>
          <p className="-mt-2 text-xs text-muted-foreground">The first photo is the cover. Use ← to move a photo earlier. Large photos are shrunk automatically.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {d.images.map((im, i) => (
              <figure key={im.url} className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
                <img src={im.url} alt="" className={cn("size-full object-cover", im.uploading && "animate-pulse opacity-50")} />
                {i === 0 ? <span className="absolute bottom-1.5 left-1.5 rounded bg-cocoa px-2 py-0.5 text-[10px] font-bold text-white">Cover</span>
                  : <button type="button" aria-label="Move earlier" onClick={() => setD((x) => { const a = [...x.images];[a[i - 1], a[i]] = [a[i], a[i - 1]]; return { ...x, images: a } })}
                    className="absolute bottom-1.5 left-1.5 grid size-7 place-items-center rounded-full bg-white/90"><ArrowLeft className="size-3.5" /></button>}
                <button type="button" aria-label="Remove photo" onClick={() => set("images", d.images.filter((_, j) => j !== i))}
                  className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-destructive"><X className="size-3.5" /></button>
              </figure>
            ))}
            <label className="grid aspect-[4/5] cursor-pointer place-items-center rounded-lg border-[1.5px] border-dashed border-[#d2bfa6] text-rust hover:bg-[#fdf3e2]">
              <span className="flex flex-col items-center gap-1 text-xs font-bold"><ImagePlus className="size-5" />Add photos</span>
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = "" }} />
            </label>
          </div>

          <h4 className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Basics</h4>
          <div className={field}><Label htmlFor="p-name">Product name</Label><Input id="p-name" required value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Peach Tissue Silk Saree" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={field}><Label htmlFor="p-raga">Raga name</Label><Input id="p-raga" value={d.raga} onChange={(e) => set("raga", e.target.value)} placeholder="e.g. Bhairavi" /></div>
            <div className={field}><Label>Mood</Label>
              <Select value={d.mood} onValueChange={(v) => set("mood", v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(MOODS).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={field}><Label>Category</Label>
              <Select value={d.category_id} onValueChange={(v) => set("category_id", v)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className={field}><Label htmlFor="p-tag">Badge (optional)</Label><Input id="p-tag" value={d.tag} onChange={(e) => set("tag", e.target.value)} placeholder="New, Bestseller, Bridal…" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_96px]">
            <div className={field}><Label htmlFor="p-price">Selling price (₹)</Label><Input id="p-price" type="number" min={1} required value={d.price} onChange={(e) => set("price", e.target.value)} /></div>
            <div className={field}><Label htmlFor="p-mrp">MRP (₹)</Label><Input id="p-mrp" type="number" min={0} value={d.mrp} placeholder="Optional" onChange={(e) => set("mrp", e.target.value)} /></div>
            <div className={field}><Label htmlFor="p-swatch">Colour</Label><Input id="p-swatch" type="color" value={d.swatch} onChange={(e) => set("swatch", e.target.value)} className="p-1" /></div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">MRP shows struck through next to the selling price. It must be higher than the selling price.</p>

          <h4 className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Sizes &amp; stock</h4>
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

          <h4 className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Story &amp; details</h4>
          <div className={field}><Label htmlFor="p-note">Raga note (shown on the product page)</Label><Textarea id="p-note" rows={4} value={d.raga_note} onChange={(e) => set("raga_note", e.target.value)} /></div>
          <div className={field}><Label htmlFor="p-details">Details (one per line)</Label><Textarea id="p-details" rows={4} value={d.details} onChange={(e) => set("details", e.target.value)} /></div>
          <div className={field}><Label htmlFor="p-care">Care</Label><Textarea id="p-care" rows={2} value={d.care} onChange={(e) => set("care", e.target.value)} /></div>
          <label className="flex items-center gap-2.5"><Switch checked={d.active} onCheckedChange={(v) => set("active", v)} /> Show on store</label>

          {error && <p ref={errorRef} role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
          <div className="sticky bottom-0 -mx-6 flex gap-2.5 border-t bg-card px-6 py-4">
            <Button type="submit" className="h-10 px-5" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save product"}</Button>
            {!isNew && <Button type="button" variant="destructive" className="h-10 px-4" disabled={remove.isPending}
              onClick={() => confirm(`Delete “${product!.name}” permanently? Past orders keep their copy. To hide it for now, turn off “Show on store” instead.`) && remove.mutate()}>Delete</Button>}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
