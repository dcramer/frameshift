import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  publicDir:
    command === "serve"
      ? fileURLToPath(new URL("../../fixtures", import.meta.url))
      : false,
}));
