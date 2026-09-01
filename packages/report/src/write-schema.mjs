#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { visualDiffReportV1JsonSchema } from "./index.ts";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const schemaPath = path.resolve(
  packageRoot,
  "../../schemas/report-v1.schema.json",
);
const expected = `${JSON.stringify(visualDiffReportV1JsonSchema(), null, 2)}\n`;

if (process.argv.includes("--check")) {
  const actual = await fs.readFile(schemaPath, "utf8");
  if (actual !== expected) {
    throw new Error("report-v1.schema.json is stale; run pnpm schema:build");
  }
  console.log("report-v1.schema.json is current");
} else {
  await fs.mkdir(path.dirname(schemaPath), { recursive: true });
  await fs.writeFile(schemaPath, expected);
  console.log(`wrote ${schemaPath}`);
}
