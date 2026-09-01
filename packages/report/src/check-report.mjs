#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkReportDirectory } from "./directory.ts";

export { checkReportDirectory } from "./directory.ts";

function reportDirectoryFromArgument(argument) {
  const resolved = path.resolve(argument);
  return path.basename(resolved) === "report.json"
    ? path.dirname(resolved)
    : resolved;
}

async function main() {
  const args = process.argv.slice(2).filter((value) => value !== "--");
  if (args.length !== 1) {
    throw new Error("Usage: check-report.mjs <report-directory|report.json>");
  }
  const [argument] = args;
  const reportRoot = reportDirectoryFromArgument(argument);
  const report = await checkReportDirectory(reportRoot);
  const changes =
    report.summary.added + report.summary.changed + report.summary.removed;
  console.log(`checked report: ${changes} screenshot change(s)`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
