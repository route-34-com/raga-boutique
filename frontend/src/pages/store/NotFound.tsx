import { Link } from "react-router"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-24 text-center">
      <h1 className="text-5xl">This page is out of tune.</h1>
      <Button asChild className="rounded-full px-6"><Link to="/">Back home</Link></Button>
    </section>
  )
}
