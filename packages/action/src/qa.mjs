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

function changeCount(report) {
  return report.summary.added + report.summary.changed + report.summary.removed;
}

async function listPngs(root) {
  const files = [];

  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile() && entry.name.endsWith(".png")) {
        files.push(path.relative(root, absolute).split(path.sep).join("/"));
      }
    }
  }

  await visit(root);
  return files.toSorted();
}

function checkChanges(changes, report) {
  const expected = String(changeCount(report));
  if (changes !== undefined && changes !== expected) {
    throw new Error(`Expected ${expected} changes, received ${changes}`);
  }
}

async function checkReportImages(report, reportRoot) {
  const images = report.files.flatMap((file) =>
    Object.values(file.images ?? {}),
  );
  await Promise.all(
    images.map((image) =>
      fs.access(path.join(reportRoot, ...image.split("/"))),
    ),
  );
}

async function checkCurrentScreenshots(report, currentRoot, status) {
  const currentFiles = await listPngs(currentRoot);
  assert.ok(currentFiles.length > 0, "Expected current screenshots");
  for (const file of currentFiles) {
    const reportFile = report.files.find((entry) => entry.file === file);
    assert.ok(reportFile, `Report is missing current screenshot: ${file}`);
    if (status) assert.equal(reportFile.status, status);
  }
  return currentFiles;
}

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
  metadata,
  currentRoot,
) {
  const report = parseVisualDiffReport(
    JSON.parse(await fs.readFile(path.join(reportRoot, "report.json"), "utf8")),
  );
  checkChanges(changes, report);

  if (!currentRoot) {
    assert.deepEqual(report, {
      files: expectedFiles,
      ...(metadata ? { metadata } : {}),
      summary: expectedSummary,
      version: 2,
    });
  } else {
    assert.equal(report.version, 2);
    if (metadata) assert.deepEqual(report.metadata, metadata);
    for (const expectedFile of expectedFiles) {
      assert.deepEqual(
        report.files.find((file) => file.file === expectedFile.file),
        expectedFile,
      );
    }
    assert.ok(report.summary.added >= expectedSummary.added);
    assert.ok(report.summary.changed >= expectedSummary.changed);
    assert.ok(report.summary.removed >= expectedSummary.removed);
    await checkCurrentScreenshots(report, currentRoot);
  }

  await checkReportImages(report, reportRoot);
  return report;
}

export async function verifyCurrentOnlyQa(
  root,
  changes = process.env.ACTION_CHANGES,
  reportRoot = path.join(root, "report"),
  currentRoot = path.join(root, "candidate"),
) {
  const report = parseVisualDiffReport(
    JSON.parse(await fs.readFile(path.join(reportRoot, "report.json"), "utf8")),
  );
  checkChanges(changes, report);
  const currentFiles = await checkCurrentScreenshots(
    report,
    currentRoot,
    "added",
  );
  assert.equal(report.files.length, currentFiles.length);
  assert.deepEqual(report.summary, {
    added: currentFiles.length,
    changed: 0,
    removed: 0,
    unchanged: 0,
  });
  await checkReportImages(report, reportRoot);
  return report;
}

async function main() {
  const command = process.argv[2];
  const root = process.argv[3] ? path.resolve(process.argv[3]) : undefined;
  const reportRoot = process.argv[4]
    ? path.resolve(process.argv[4])
    : undefined;
  const currentRoot = process.argv[5]
    ? path.resolve(process.argv[5])
    : undefined;
  if (!root || !["prepare", "verify", "verify-current"].includes(command)) {
    throw new Error(
      "Usage: qa.mjs <prepare|verify|verify-current> <test-folder> [report-folder] [current-folder]",
    );
  }
  if (command === "prepare") {
    await prepareActionQa(root);
    console.log(`created Action test files at ${root}`);
  } else if (command === "verify") {
    const pullRequestNumber = process.env.EXPECTED_PULL_REQUEST_NUMBER;
    const pullRequestTitle = process.env.EXPECTED_PULL_REQUEST_TITLE;
    const metadata =
      pullRequestNumber && pullRequestTitle
        ? {
            pullRequest: {
              number: Number(pullRequestNumber),
              title: pullRequestTitle,
            },
          }
        : undefined;
    await verifyActionQa(
      root,
      process.env.ACTION_CHANGES,
      reportRoot,
      metadata,
      currentRoot,
    );
    console.log("checked Action test report");
  } else {
    await verifyCurrentOnlyQa(
      root,
      process.env.ACTION_CHANGES,
      reportRoot,
      currentRoot,
    );
    console.log("checked current-only Action test report");
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
