#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_DIR = path.resolve(SOURCE_DIR, "../../..");
const HONEYDIFF_DIR = path.dirname(
  fileURLToPath(import.meta.resolve("@vizzly-testing/honeydiff")),
);

export async function copyHoneydiffAssets(
  output = path.join(REPOSITORY_DIR, "dist"),
) {
  const destination = path.join(output, "platforms");
  await fs.rm(destination, { force: true, recursive: true });
  await fs.cp(path.join(HONEYDIFF_DIR, "platforms"), destination, {
    recursive: true,
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  copyHoneydiffAssets().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
