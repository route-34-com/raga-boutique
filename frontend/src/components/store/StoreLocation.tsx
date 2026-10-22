import { Clock, MapPin, Navigation, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useSettings } from "@/hooks/queries"
import { fmtPhone } from "@/lib/format"

const directionsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Raga Boutique, " + address)}`

export function StoreLocation({ className }: { className?: string }) {
  const { data: s } = useSettings()
  if (!s?.contact_address) return null
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={className} aria-label="Visit our store"><MapPin className="size-5" strokeWidth={1.6} /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-80 rounded-2xl bg-paper p-5">
        <p className="eyebrow mb-2">Visit the boutique</p>
        <p className="font-heading text-xl text-cocoa">Raga Boutique</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.contact_address}</p>
        {s.contact_hours && <p className="mt-2 flex items-center gap-2 text-sm"><Clock className="size-4 text-rust" />{s.contact_hours}</p>}
        <div className="mt-4 flex gap-2">
          <Button asChild className="h-10 flex-1 rounded-full"><a href={directionsUrl(s.contact_address)} target="_blank" rel="noopener"><Navigation className="size-4" />Directions</a></Button>
          {s.contact_phone && <Button asChild variant="outline" className="h-10 rounded-full border-cocoa bg-transparent"><a href={`tel:+91${s.contact_phone}`} aria-label={`Call ${fmtPhone(s.contact_phone)}`}><Phone className="size-4" />Call</a></Button>}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
