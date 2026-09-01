#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkReportDirectory } from "./check-report.mjs";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixturesRoot = path.resolve(packageRoot, "../../fixtures");

const fixtures = (await fs.readdir(fixturesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .toSorted();
if (fixtures.length === 0) throw new Error("No sample reports found");

for (const fixture of fixtures) {
  await checkReportDirectory(path.join(fixturesRoot, fixture));
}
console.log(`checked ${fixtures.length} sample report(s)`);
