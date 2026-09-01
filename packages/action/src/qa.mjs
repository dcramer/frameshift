#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseVisualDiffReport } from "@frameshift/report";
import { PNG } from "pngjs";

const expectedSummary = {
  added: 1,
  changed: 1,
  removed: 1,
  unchanged: 0,
};

const expectedFiles = [
  {
    file: "added.png",
    image: "images/candidate/added.png",
    images: { candidate: "images/candidate/added.png" },
    status: "added",
  },
  {
    file: "changed.png",
    height: 2,
    image: "images/diff/changed.png",
    images: {
      baseline: "images/baseline/changed.png",
      candidate: "images/candidate/changed.png",
      diff: "images/diff/changed.png",
    },
    status: "changed",
    width: 2,
  },
  {
    file: "removed.png",
    image: "images/baseline/removed.png",
    images: { baseline: "images/baseline/removed.png" },
    status: "removed",
  },
];

async function writePng(file, color) {
  const image = new PNG({ height: 2, width: 2 });
  for (let index = 0; index < image.data.length; index += 4) {
    image.data.set(color, index);
  }
  await fs.writeFile(file, PNG.sync.write(image));
}

export async function prepareActionQa(root) {
  await fs.mkdir(root);
  const baseline = path.join(root, "baseline");
  const candidate = path.join(root, "candidate");
  await Promise.all([fs.mkdir(baseline), fs.mkdir(candidate)]);
  await Promise.all([
    writePng(path.join(baseline, "changed.png"), [255, 255, 255, 255]),
    writePng(path.join(candidate, "changed.png"), [0, 0, 0, 255]),
    writePng(path.join(baseline, "removed.png"), [255, 255, 255, 255]),
    writePng(path.join(candidate, "added.png"), [0, 0, 0, 255]),
  ]);
  return { baseline, candidate, output: path.join(root, "report") };
}

export async function verifyActionQa(
  root,
  changes = process.env.ACTION_CHANGES,
  reportRoot = path.join(root, "report"),
) {
  if (changes !== undefined && changes !== "3") {
    throw new Error(`Expected 3 changes, received ${changes}`);
  }

  const report = parseVisualDiffReport(
    JSON.parse(await fs.readFile(path.join(reportRoot, "report.json"), "utf8")),
  );
  assert.deepEqual(report, {
    files: expectedFiles,
    summary: expectedSummary,
    version: 2,
  });

  const images = report.files.flatMap((file) =>
    Object.values(file.images ?? {}),
  );
  await Promise.all(
    images.map((image) =>
      fs.access(path.join(reportRoot, ...image.split("/"))),
    ),
  );
  return report;
}

async function main() {
  const command = process.argv[2];
  const root = process.argv[3] ? path.resolve(process.argv[3]) : undefined;
  const reportRoot = process.argv[4]
    ? path.resolve(process.argv[4])
    : undefined;
  if (!root || !["prepare", "verify"].includes(command)) {
    throw new Error("Usage: qa.mjs <prepare|verify> <test-folder>");
  }
  if (command === "prepare") {
    await prepareActionQa(root);
    console.log(`created Action test files at ${root}`);
  } else {
    await verifyActionQa(root, process.env.ACTION_CHANGES, reportRoot);
    console.log("checked Action test report");
  }
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
