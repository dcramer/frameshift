import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, expect, test } from "vitest";

import { compareDirectories } from "./compare.mjs";
import { prepareActionQa, verifyActionQa, verifyCurrentOnlyQa } from "./qa.mjs";

let tempRoot;
let paths;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "frameshift-qa-"));
  paths = await prepareActionQa(path.join(tempRoot, "fixture"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { force: true, recursive: true });
});

test("checks the synthetic contract alongside product screenshots", async () => {
  await Promise.all([
    fs.copyFile(
      path.join(paths.candidate, "added.png"),
      path.join(paths.baseline, "home.png"),
    ),
    fs.copyFile(
      path.join(paths.candidate, "added.png"),
      path.join(paths.candidate, "home.png"),
    ),
  ]);
  const report = await compareDirectories(paths);

  await expect(
    verifyActionQa(
      path.join(tempRoot, "fixture"),
      "3",
      paths.output,
      undefined,
      paths.candidate,
    ),
  ).resolves.toEqual(report);
  expect(report.summary.unchanged).toBe(1);
});

test("checks a report when every current screenshot is new", async () => {
  const baseline = path.join(tempRoot, "empty");
  await fs.mkdir(baseline);
  const report = await compareDirectories({
    baseline,
    candidate: paths.candidate,
    output: paths.output,
  });

  await expect(
    verifyCurrentOnlyQa(
      path.join(tempRoot, "fixture"),
      "2",
      paths.output,
      paths.candidate,
    ),
  ).resolves.toEqual(report);
  expect(report.summary).toEqual({
    added: 2,
    changed: 0,
    removed: 0,
    unchanged: 0,
  });
});
