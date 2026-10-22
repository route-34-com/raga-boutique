import { Button } from "@/components/ui/button"
import { useLoginDialog } from "@/stores/login"

export function LoginPrompt({ title, text }: { title: string; text: string }) {
  const ask = useLoginDialog((s) => s.ask)
  return (
    <section className="container-x pt-5 md:pt-6">
      <h1 className="text-[clamp(36px,4.6vw,60px)] leading-none">{title}</h1>
      <div className="flex flex-col items-center gap-5 py-16 text-center">
        <p className="max-w-md font-heading text-xl italic text-rust">{text}</p>
        <Button className="h-12 rounded-full px-7" onClick={() => ask()}>Log in with mobile</Button>
      </div>
    </section>
  )
}
