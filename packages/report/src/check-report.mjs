#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseVisualDiffReport } from "./index.ts";

async function listFiles(root, directory = root) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, absolute)));
    } else if (entry.isFile()) {
      files.push(relative);
    } else {
      throw new Error(`Report bundle contains unsupported entry: ${relative}`);
    }
  }
  return files;
}

export async function checkReportDirectory(reportRoot) {
  const root = path.resolve(reportRoot);
  const rootStat = await fs.lstat(root);
  if (!rootStat.isDirectory()) {
    throw new Error(`Report path is not a directory: ${root}`);
  }

  const report = parseVisualDiffReport(
    JSON.parse(await fs.readFile(path.join(root, "report.json"), "utf8")),
  );
  const referencedImages = report.files.flatMap((file) =>
    file.status === "unchanged" ? [] : Object.values(file.images),
  );
  const expectedFiles = new Set(["report.json", ...referencedImages]);
  const actualFiles = new Set(await listFiles(root));
  const missing = [...expectedFiles]
    .filter((file) => !actualFiles.has(file))
    .toSorted();
  const unexpected = [...actualFiles]
    .filter((file) => !expectedFiles.has(file))
    .toSorted();

  if (missing.length > 0 || unexpected.length > 0) {
    const details = [
      missing.length > 0 ? `missing ${missing.join(", ")}` : undefined,
      unexpected.length > 0 ? `unexpected ${unexpected.join(", ")}` : undefined,
    ]
      .filter(Boolean)
      .join("; ");
    throw new Error(`Invalid report bundle: ${details}`);
  }

  return report;
}

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
  console.log(`validated report with ${changes} visual change(s)`);
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
