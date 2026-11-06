import type { LucideIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = ComponentProps<typeof Button> & { icon: LucideIcon; label: string; busy?: ReactNode }

/** Icon and text on wider screens, icon only on phones; the label stays readable to screen readers. */
export function ActionButton({ icon: Icon, label, busy, className, children, ...props }: Props) {
  return (
    <Button title={label} className={cn("max-sm:size-10 max-sm:px-0", className)} {...props}>
      {busy ?? <Icon />}
      <span className="max-sm:sr-only">{children ?? label}</span>
    </Button>
  )
}
