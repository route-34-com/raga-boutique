export type Cell = string | number | null | undefined
export type Sheet = { name: string; header: string[]; rows: Cell[][] }

const esc = (v: Cell) => {
  const s = v == null ? "" : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Saves rows as a CSV that Excel opens directly (UTF-8 with BOM keeps ₹ and Tamil names intact). */
export function downloadExcel(file: string, sheet: Sheet) {
  const body = [sheet.header, ...sheet.rows].map((r) => r.map(esc).join(",")).join("\r\n")
  const url = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }))
  const a = Object.assign(document.createElement("a"), { href: url, download: `${file}.csv` })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Opens the print dialog; the page's print styles hide the panel chrome so "Save as PDF" gives a clean report. */
export function downloadPdf(file: string) {
  const title = document.title
  document.title = file
  window.addEventListener("afterprint", () => { document.title = title }, { once: true })
  window.print()
}

export const isoDate = (s: string | null | undefined) => (s ? s.slice(0, 10) : "")
