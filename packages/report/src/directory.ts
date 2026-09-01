import fs from "node:fs/promises";
import path from "node:path";

import { parseVisualDiffReport, type VisualDiffReport } from "./index.ts";

async function listFiles(root: string, directory = root): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, absolute)));
    } else if (entry.isFile()) {
      files.push(relative);
    } else {
      throw new Error(
        `The report folder contains a file Frameshift cannot use: ${relative}`,
      );
    }
  }
  return files;
}

export async function checkReportDirectory(
  reportRoot: string,
): Promise<VisualDiffReport> {
  const root = path.resolve(reportRoot);
  const rootStat = await fs.lstat(root);
  if (!rootStat.isDirectory()) {
    throw new Error(`The report path is not a folder: ${root}`);
  }

  const report = parseVisualDiffReport(
    JSON.parse(await fs.readFile(path.join(root, "report.json"), "utf8")),
  );
  const referencedImages = report.files.flatMap((file) =>
    Object.values(file.images),
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
    throw new Error(`The report folder is incomplete: ${details}`);
  }

  return report;
}
