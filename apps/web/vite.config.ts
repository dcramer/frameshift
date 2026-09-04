import react from "@vitejs/plugin-react";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
  const reportDirectory = process.env.FRAMESHIFT_REPORT_DIRECTORY;
  const fixturesDirectory = fileURLToPath(
    new URL("../../fixtures", import.meta.url),
  );
  const reportAssetsDirectory = reportDirectory || fixturesDirectory;
  const publicAssets = [
    {
      fileName: "frameshift-social.png",
      path: fileURLToPath(
        new URL("./src/assets/frameshift-social.png", import.meta.url),
      ),
    },
    {
      fileName: "robots.txt",
      path: fileURLToPath(new URL("./static/robots.txt", import.meta.url)),
    },
    {
      fileName: "sitemap.xml",
      path: fileURLToPath(new URL("./static/sitemap.xml", import.meta.url)),
    },
  ];
  const input = {
    main: fileURLToPath(new URL("./index.html", import.meta.url)),
    sample: fileURLToPath(new URL("./sample/index.html", import.meta.url)),
    guide: fileURLToPath(new URL("./guide/index.html", import.meta.url)),
    setupRedirect: fileURLToPath(
      new URL("./setup/index.html", import.meta.url),
    ),
  };
  return {
    build: {
      cssCodeSplit: false,
      rollupOptions: {
        input,
        output: {
          assetFileNames: (assetInfo) =>
            assetInfo.names.some((name) => name.endsWith(".css"))
              ? "assets/main.css"
              : "assets/[name]-[hash][extname]",
          chunkFileNames: "assets/client.js",
          entryFileNames: "assets/[name].js",
        },
      },
    },
    environments: {
      client: {
        build: {
          rollupOptions: { input },
        },
      },
    },
    plugins: [
      ...(process.env.VITEST
        ? []
        : [
            nitro({
              publicAssets: [{ dir: reportAssetsDirectory, maxAge: 0 }],
              serverDir: "server",
            }),
          ]),
      react(),
      {
        apply: "build",
        buildStart() {
          for (const asset of publicAssets) {
            this.emitFile({
              fileName: asset.fileName,
              source: fs.readFileSync(asset.path),
              type: "asset",
            });
          }
        },
        name: "frameshift-public-assets",
      },
    ],
    publicDir: command === "serve" ? reportAssetsDirectory : fixturesDirectory,
  };
});
