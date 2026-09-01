import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
  const reportDirectory = process.env.FRAMESHIFT_REPORT_DIRECTORY;
  return {
    plugins: [react()],
    publicDir:
      command === "serve"
        ? reportDirectory ||
          fileURLToPath(new URL("../../fixtures", import.meta.url))
        : false,
  };
});
