import { toast } from "sonner"

import { LoginForm } from "@/components/common/LoginForm"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useLoginDialog } from "@/stores/login"

export function LoginDialog() {
  const { open, onDone, close } = useLoginDialog()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="bg-background p-7 sm:max-w-[420px]">
        <DialogTitle className="sr-only">Log in</DialogTitle>
        <DialogDescription className="sr-only">Log in with your mobile number and a one-time code</DialogDescription>
        <img src="/brand/logo-sm.png" alt="Raga" className="mb-1 w-28" />
        {open && (
          <LoginForm onSuccess={() => { toast.success("You're logged in."); const then = onDone; close(); then?.() }} />
        )}
      </DialogContent>
    </Dialog>
  )
}
