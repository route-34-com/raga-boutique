import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

// The two web fonts are only found after the stylesheet has loaded; preloading the Latin files lets the browser
// fetch them alongside it, so headings and text paint sooner. Their names carry a build hash, so they're found here.
function preloadFonts(): Plugin {
  return {
    name: "raga-preload-fonts",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const fonts = Object.keys(ctx.bundle ?? {}).filter((f) => /\/(fraunces|manrope)-latin-wght-normal-[\w-]+\.woff2$/.test(f))
        return fonts.map((f) => ({
          tag: "link",
          attrs: { rel: "preload", as: "font", type: "font/woff2", href: `/${f}`, crossorigin: "" },
          injectTo: "head-prepend" as const,
        }))
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadFonts()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/uploads": "http://127.0.0.1:8000",
    },
  },
})
