import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
  const reportDirectory = process.env.FRAMESHIFT_REPORT_DIRECTORY;
  const fixturesDirectory = fileURLToPath(
    new URL("../../fixtures", import.meta.url),
  );
  return {
    plugins: [react()],
    publicDir:
      command === "serve"
        ? reportDirectory || fixturesDirectory
        : fixturesDirectory,
  };
});
