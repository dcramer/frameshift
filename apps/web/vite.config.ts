import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
  const reportDirectory = process.env.FRAMESHIFT_REPORT_DIRECTORY;
  const fixturesDirectory = fileURLToPath(
    new URL("../../fixtures", import.meta.url),
  );
  return {
    build: {
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL("./index.html", import.meta.url)),
          report: fileURLToPath(
            new URL("./report/index.html", import.meta.url),
          ),
          sample: fileURLToPath(
            new URL("./sample/index.html", import.meta.url),
          ),
          setup: fileURLToPath(new URL("./setup/index.html", import.meta.url)),
        },
      },
    },
    plugins: [react()],
    publicDir:
      command === "serve"
        ? reportDirectory || fixturesDirectory
        : fixturesDirectory,
  };
});
