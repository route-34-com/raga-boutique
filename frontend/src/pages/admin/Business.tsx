import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router"

import { PageHead } from "@/components/admin/AdminLayout"
import { Empty, MonthPicker, Stat } from "@/components/admin/money"
import { monthLabel, signed, thisMonth } from "@/lib/dates"
import { PageLoader } from "@/components/common/PageLoader"
import { api } from "@/lib/api"
import { inr } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ExportButton } from "@/components/common/ExportButton"

type Month = { month: string; sales: number; cogs: number; expenses: number; salaries: number; net_profit: number }
type Summary = Month & {
  orders: number; shipping: number; uncosted_sales: number; gross_profit: number; purchases: number
  expense_split: { category: string; amount: number }[]
  top: { product_id: number; name: string; units: number; revenue: number; cost: number; profit: number }[]
  trend: Month[]; stock_at_cost: number; stock_at_price: number; pieces_without_cost: number
  cod_due: number; advances_out: number; salary_due: number
}

const GAIN = "#0f8a5f"
const LOSS = "#b4532a"

function ProfitChart({ trend, current }: { trend: Month[]; current: string }) {
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(1, ...trend.map((m) => Math.abs(m.net_profit)))
  const hasLoss = trend.some((m) => m.net_profit < 0)
  const H = 150
  const zero = hasLoss ? H / 2 : H
  const scale = (hasLoss ? H / 2 : H) - 14
  return (
    <figure>
      <div className="relative" style={{ height: H + 24 }}>
        <div className="absolute inset-x-0 border-t border-foreground/25" style={{ top: zero }} />
        <div className="absolute inset-0 grid grid-cols-6 gap-3">
          {trend.map((m, i) => {
            const h = Math.max(2, (Math.abs(m.net_profit) / max) * scale)
            const up = m.net_profit >= 0
            return (
              <button key={m.month} type="button" className="relative outline-none" onMouseEnter={() => setHover(m.month)} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(m.month)} onBlur={() => setHover(null)} aria-label={`${monthLabel(m.month)}: ${signed(m.net_profit)}`}>
                <span className={cn("absolute left-1/2 w-[46%] -translate-x-1/2", up ? "rounded-t-[4px]" : "rounded-b-[4px]", hover && hover !== m.month && "opacity-45")}
                  style={{ background: up ? GAIN : LOSS, height: h, top: up ? zero - h : zero }} />
                <span className="absolute inset-x-0 text-center text-[11px] font-semibold tabular-nums text-foreground" style={{ top: up ? zero - h - 16 : zero + h + 2 }}>
                  {m.net_profit >= 0 ? "+" : "−"}{Math.abs(Math.round(m.net_profit / 1000))}k
                </span>
                <span className={cn("absolute inset-x-0 bottom-0 text-center text-xs", m.month === current ? "font-bold text-foreground" : "text-muted-foreground")}>{monthLabel(m.month, true)}</span>
                {hover === m.month && (
                  <span className={cn("pointer-events-none absolute z-10 w-44 -translate-y-1/2 rounded-lg border bg-popover p-2.5 text-left text-xs shadow-lg", i >= trend.length - 2 ? "right-[76%]" : "left-[76%]")} style={{ top: zero }}>
                    <strong className="mb-1 block text-sm">{monthLabel(m.month)}</strong>
                    <span className="flex justify-between"><span>Sales</span>{inr(m.sales)}</span>
                    <span className="flex justify-between text-muted-foreground"><span>Cost of pieces</span>−{inr(m.cogs)}</span>
                    <span className="flex justify-between text-muted-foreground"><span>Expenses</span>−{inr(m.expenses)}</span>
                    <span className="flex justify-between text-muted-foreground"><span>Salaries</span>−{inr(m.salaries)}</span>
                    <span className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Profit</span>{signed(m.net_profit)}</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <figcaption className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: GAIN }} />Profit (above the line)</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: LOSS }} />Loss (below the line)</span>
      </figcaption>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-rust">Show as a table</summary>
        <table className="mt-2 w-full text-right tabular-nums">
          <thead><tr className="text-xs text-muted-foreground"><th className="text-left font-semibold">Month</th><th className="font-semibold">Sales</th><th className="font-semibold">Costs</th><th className="font-semibold">Profit</th></tr></thead>
          <tbody>{trend.map((m) => (
            <tr key={m.month} className="border-t"><td className="py-1 text-left">{monthLabel(m.month, true)}</td><td>{inr(m.sales)}</td><td>{inr(m.cogs + m.expenses + m.salaries)}</td>
              <td className="font-semibold">{signed(m.net_profit)}</td></tr>
          ))}</tbody>
        </table>
      </details>
    </figure>
  )
}

function Line({ label, value, strong, minus, note }: { label: string; value: number; strong?: boolean; minus?: boolean; note?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-2 text-sm", strong ? "border-t font-semibold" : "text-muted-foreground")}>
      <span>{label}{note && <span className="block text-xs font-normal">{note}</span>}</span>
      <span className={cn("tabular-nums", strong && "text-base text-foreground")}>{minus ? `−${inr(value)}` : signed(value)}</span>
    </div>
  )
}

export default function Business() {
  const [month, setMonth] = useState(thisMonth())
  const { data: b } = useQuery({ queryKey: ["admin", "business", month], queryFn: () => api<Summary>(`/api/admin/business?month=${month}`), placeholderData: (prev) => prev })
  if (!b) return <PageLoader />
  const margin = b.sales - b.shipping - b.uncosted_sales > 0 ? Math.round((b.gross_profit / (b.sales - b.shipping - b.uncosted_sales)) * 100) : 0

  return (
    <>
      <PageHead eyebrow="Money" title="Business">
        <div className="print:hidden"><MonthPicker value={month} onChange={setMonth} /></div>
        <ExportButton file={`Raga-Business-${month}`} pdf sheet={() => ({
          name: "Business", header: ["Line", "Amount (₹)"],
          rows: [["Month", monthLabel(month)], ["Website orders", b.orders], ["Sales", b.sales], ["Shipping charged", b.shipping], ["Sales with no purchase cost", b.uncosted_sales],
            ["Cost of pieces sold", b.cogs], ["Profit on pieces sold", b.gross_profit], ...b.expense_split.map((e): [string, number] => [e.category, e.amount]),
            ["Salaries", b.salaries], ["Profit after costs", b.net_profit], ["", ""], ["Stock bought this month", b.purchases], ["Stock in hand at cost", b.stock_at_cost],
            ["Stock in hand at selling price", b.stock_at_price], ["Cash on delivery to collect", b.cod_due], ["Advances with staff", b.advances_out], ["Salaries still to pay", b.salary_due],
            ["", ""], ["Last 6 months", ""], ...b.trend.map((t): [string, number] => [`${monthLabel(t.month)} profit`, t.net_profit])],
        })} />
      </PageHead>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sales" value={inr(b.sales)} sub={`${b.orders} order${b.orders === 1 ? "" : "s"} on the website`} />
        <Stat label="Profit on pieces sold" value={signed(b.gross_profit)} sub={`${margin}% margin over cost`} tone={b.gross_profit >= 0 ? "good" : "bad"} />
        <Stat label="Running costs" value={inr(b.expenses + b.salaries)} sub={`${inr(b.expenses)} expenses · ${inr(b.salaries)} salaries`} />
        <Stat label="Profit after costs" value={signed(b.net_profit)} sub={b.net_profit >= 0 ? "in hand this month" : "costs were more than profit"} tone={b.net_profit >= 0 ? "good" : "bad"} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Stock bought this month" value={inr(b.purchases)} sub="money gone into new pieces" />
        <Stat label="Stock in hand" value={inr(b.stock_at_cost)} sub={`at cost · sells for ${inr(b.stock_at_price)}`} />
        <Stat label="Cash on delivery to collect" value={inr(b.cod_due)} sub="orders not yet paid" />
        <Stat label="Advances with staff" value={inr(b.advances_out)} sub="still to come back" />
        <Stat label="Salaries still to pay" value={inr(b.salary_due)} sub={monthLabel(month)} />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-6 text-xl">Profit, last 6 months</h3>
          <ProfitChart trend={b.trend} current={month} />
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="mb-2 text-xl">How {monthLabel(month)} adds up</h3>
          <Line label="Sales" value={b.sales} />
          {b.shipping > 0 && <Line label="Shipping charged" value={b.shipping} minus note="passed on to the courier" />}
          {b.uncosted_sales > 0 && <Line label="Sales with no purchase cost" value={b.uncosted_sales} minus note="add their purchases to count them" />}
          <Line label="Cost of pieces sold" value={b.cogs} minus />
          <Line label="Profit on pieces sold" value={b.gross_profit} strong />
          {b.expense_split.map((e) => <Line key={e.category} label={e.category} value={e.amount} minus />)}
          <Line label="Salaries" value={b.salaries} minus />
          <Line label="Profit after costs" value={b.net_profit} strong />
        </section>
      </div>


      <section className="mt-5 rounded-2xl border bg-card p-5">
        <div className="mb-2 flex items-baseline justify-between"><h3 className="text-xl">Best earners · {monthLabel(month)}</h3><Link to="/admin/purchases" className="link-quiet text-[13px] font-semibold">Purchases →</Link></div>
        {b.top.length ? (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[560px] text-sm tabular-nums">
              <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 font-semibold">Piece</th><th className="text-right font-semibold">Sold</th><th className="text-right font-semibold">Sales</th><th className="text-right font-semibold">Cost</th><th className="text-right font-semibold">Profit</th></tr></thead>
              <tbody>{b.top.map((t) => (
                <tr key={t.product_id} className="border-b last:border-0"><td className="py-2.5 font-semibold">{t.name}</td><td className="text-right">{t.units}</td>
                  <td className="text-right">{inr(t.revenue)}</td><td className="text-right text-muted-foreground">{inr(t.cost)}</td>
                  <td className="text-right font-semibold">{signed(t.profit)} <span className="text-xs font-normal text-muted-foreground">({Math.round((t.profit / t.revenue) * 100)}%)</span></td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty>No sales with a purchase cost this month yet.</Empty>}
        {b.pieces_without_cost > 0 && <p className="mt-3 rounded-lg bg-sand/40 px-3 py-2 text-xs">{b.pieces_without_cost} piece{b.pieces_without_cost === 1 ? " has" : "s have"} no purchase cost yet, so {b.pieces_without_cost === 1 ? "its" : "their"} profit can't be worked out. Add them under <Link to="/admin/purchases" className="link-quiet font-semibold">Purchases</Link>.</p>}
      </section>
    </>
  )
}
