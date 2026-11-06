import { create } from "zustand"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"

type Ask = { title: string; body?: React.ReactNode; action?: string; cancel?: string; danger?: boolean }
type State = { ask: (Ask & { resolve: (ok: boolean) => void }) | null }

const useConfirmStore = create<State>(() => ({ ask: null }))

/** Shared approval step for anything that deletes or removes. Resolves true only when the person confirms. */
export function confirmAction(ask: Ask): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.setState({ ask: { danger: true, ...ask, resolve } }))
}

/** Runs `fn` after approval. */
export const withApproval = (ask: Ask, fn: () => void) => () => { void confirmAction(ask).then((ok) => ok && fn()) }

export function ConfirmHost() {
  const ask = useConfirmStore((s) => s.ask)
  const close = (ok: boolean) => { ask?.resolve(ok); useConfirmStore.setState({ ask: null }) }
  return (
    <Dialog open={!!ask} onOpenChange={(open) => !open && close(false)}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogTitle className="text-xl">{ask?.title}</DialogTitle>
        {ask?.body && <DialogDescription className="text-sm leading-relaxed">{ask.body}</DialogDescription>}
        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" onClick={() => close(false)}>{ask?.cancel ?? "Keep it"}</Button>
          <Button variant={ask?.danger ? "destructive" : "default"} autoFocus onClick={() => close(true)}>{ask?.action ?? "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
