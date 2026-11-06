import { Download, FileDown, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { downloadExcel, downloadPdf, type Sheet } from "@/lib/exports"

/** Shared export control: one download icon. Excel for lists; with `pdf` it offers Excel or PDF. */
export function ExportButton({ file, sheet, pdf }: { file: string; sheet?: () => Sheet; pdf?: boolean }) {
  const excel = () => {
    if (!sheet) return
    const s = sheet()
    if (!s.rows.length) return void toast("Nothing to download yet.")
    downloadExcel(file, s)
    toast.success(`Downloaded ${s.rows.length} row${s.rows.length === 1 ? "" : "s"} for Excel.`)
  }
  const icon = (props: React.ComponentProps<typeof Button>) => (
    <Button type="button" variant="outline" size="icon" aria-label="Download" title="Download" className="size-10 rounded-full bg-card print:hidden" {...props}><Download className="size-4" /></Button>
  )
  if (!pdf) return icon({ onClick: excel })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{icon({})}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {sheet && <DropdownMenuItem onSelect={excel}><FileSpreadsheet />Excel</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => downloadPdf(file)}><FileDown />PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
