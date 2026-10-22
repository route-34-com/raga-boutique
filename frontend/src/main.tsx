import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"

import { PageLoader } from "@/components/common/PageLoader"
import { Toaster } from "@/components/ui/sonner"
import { router } from "@/router"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<PageLoader />}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster theme="light" position="bottom-center" />
    </QueryClientProvider>
  </StrictMode>,
)
