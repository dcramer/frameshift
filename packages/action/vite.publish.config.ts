import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    minify: true,
    outDir: "../../publish/dist",
    rollupOptions: {
      output: {
        entryFileNames: "index.mjs",
        format: "es",
      },
    },
    ssr: "src/publish.mjs",
    target: "node24",
  },
  ssr: {
    noExternal: true,
  },
});
