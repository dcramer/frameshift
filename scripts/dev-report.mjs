#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";

import { checkReportDirectory } from "../packages/report/src/check-report.mjs";

const args = process.argv.slice(2).filter((value) => value !== "--");
if (args.length !== 1) {
  throw new Error("Usage: pnpm dev:report -- <report-directory|report.json>");
}
const [argument] = args;

const resolved = path.resolve(argument);
const reportDirectory =
  path.basename(resolved) === "report.json" ? path.dirname(resolved) : resolved;
const report = await checkReportDirectory(reportDirectory);
const changes =
  report.summary.added + report.summary.changed + report.summary.removed;
console.log(`opening local report with ${changes} visual change(s)`);

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(
  pnpm,
  ["--filter", "@frameshift/web", "dev", "--open", "/report/?local=1"],
  {
    env: {
      ...process.env,
      FRAMESHIFT_REPORT_DIRECTORY: reportDirectory,
    },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
