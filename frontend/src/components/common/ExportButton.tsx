import { FileDown, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { downloadExcel, downloadPdf, type Sheet } from "@/lib/exports"

/** Shared export control. Excel for lists; PDF (print) for report-style pages. */
export function ExportButton({ file, sheet, pdf }: { file: string; sheet?: () => Sheet; pdf?: boolean }) {
  return (
    <div className="flex gap-2 print:hidden">
      {sheet && (
        <Button type="button" variant="outline" className="h-10 bg-card px-3.5" onClick={() => {
          const s = sheet()
          if (!s.rows.length) return toast("Nothing to export yet.")
          downloadExcel(file, s)
          toast.success(`Exported ${s.rows.length} row${s.rows.length === 1 ? "" : "s"} to Excel.`)
        }}><FileSpreadsheet className="size-4" />Excel</Button>
      )}
      {pdf && <Button type="button" variant="outline" className="h-10 bg-card px-3.5" onClick={() => downloadPdf(file)}><FileDown className="size-4" />PDF</Button>}
    </div>
  )
}
