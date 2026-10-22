import { create } from "zustand"

// Global "log in" dialog, so any page can ask for login and continue afterwards.
type LoginState = {
  open: boolean
  onDone: (() => void) | null
  ask: (onDone?: () => void) => void
  close: () => void
}

export const useLoginDialog = create<LoginState>()((set) => ({
  open: false,
  onDone: null,
  ask: (onDone) => set({ open: true, onDone: onDone ?? null }),
  close: () => set({ open: false, onDone: null }),
}))
