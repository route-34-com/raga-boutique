import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { keys } from "@/hooks/queries"
import { ApiError, post } from "@/lib/api"
import type { User } from "@/lib/types"

type Props = { onSuccess?: (user: User) => void; title?: string; subtitle?: string }

export function LoginForm({ onSuccess, title = "Log in or sign up", subtitle }: Props) {
  const qc = useQueryClient()
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [devCode, setDevCode] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    setError("")
    if (!/^[6-9]\d{9}$/.test(phone)) return setError("Please enter a valid 10-digit mobile number.")
    setBusy(true)
    try {
      const r = await post<{ dev_code: string | null }>("/api/auth/otp", { phone })
      setDevCode(r.dev_code)
      setCode("")
      setStep("otp")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the code.")
    } finally {
      setBusy(false)
    }
  }

  async function verify(value = code) {
    if (value.length !== 6) return
    setError("")
    setBusy(true)
    try {
      const user = await post<User>("/api/auth/verify", { phone, code: value })
      qc.setQueryData(keys.me, user)
      onSuccess?.(user)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't verify the code.")
      setCode("")
    } finally {
      setBusy(false)
    }
  }

  if (step === "phone")
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <div>
          <h3 className="text-2xl">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {subtitle ?? "We'll text a 6-digit code to your mobile. Your orders stay linked to this number."}
          </p>
        </div>
        <label className="flex h-12 items-center overflow-hidden rounded-xl border bg-paper focus-within:ring-3 focus-within:ring-ring/40">
          <span className="border-r px-3 text-sm font-semibold text-muted-foreground">+91</span>
          <Input
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit mobile number"
            aria-label="Mobile number"
            className="h-full border-0 bg-transparent text-base tracking-wide shadow-none focus-visible:ring-0"
          />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="h-12 w-full rounded-full text-sm" disabled={busy}>
          {busy ? "Sending…" : "Send code"}
        </Button>
      </form>
    )

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl">Enter the code</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sent to <strong className="text-foreground">+91 {phone}</strong> ·{" "}
          <button type="button" className="underline" onClick={() => setStep("phone")}>Change</button>
        </p>
      </div>
      <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={verify} autoFocus disabled={busy} containerClassName="justify-center">
        <InputOTPGroup>
          {Array.from({ length: 6 }, (_, i) => <InputOTPSlot key={i} index={i} className="size-12 bg-paper text-lg" />)}
        </InputOTPGroup>
      </InputOTP>
      {devCode && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Demo mode — no SMS is sent. Your code is <strong>{devCode}</strong>.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button size="lg" className="h-12 flex-1 rounded-full" disabled={busy || code.length !== 6} onClick={() => verify()}>
          {busy ? "Checking…" : "Verify & continue"}
        </Button>
        <Button variant="ghost" size="lg" className="h-12" disabled={busy} onClick={() => sendCode()}>Resend</Button>
      </div>
    </div>
  )
}
