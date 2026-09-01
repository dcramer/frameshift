#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compareDirectories } from "./compare.mjs";
import { renderSamplePage } from "./sample-page.mjs";

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));
export const committedFixtureRoot = path.resolve(
  sourceRoot,
  "../../../fixtures/mixed",
);
async function writePng(root, relative, image) {
  const destination = path.join(root, ...relative.split("/"));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, image);
}

export async function generateMixedFixture(output = committedFixtureRoot) {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "frameshift-fixture-"),
  );
  const baseline = path.join(tempRoot, "baseline");
  const candidate = path.join(tempRoot, "candidate");

  try {
    await Promise.all([fs.mkdir(baseline), fs.mkdir(candidate)]);
    const [before, after, added, removed, unchanged] = await Promise.all([
      renderSamplePage(),
      renderSamplePage({
        announcementBar: true,
        headline: ["Plan team travel", "without the", "busywork."],
        metric: "12 min",
        primaryAction: "Start free",
      }),
      renderSamplePage({
        announcementBar: true,
        headline: ["Every traveler,", "one clear", "itinerary."],
        metric: "4 trips",
        primaryAction: "Open itinerary",
      }),
      renderSamplePage({
        headline: ["Approvals that", "keep trips", "moving."],
        metric: "2 days",
        primaryAction: "Review policy",
      }),
      renderSamplePage({
        headline: ["Your team,", "ready for", "takeoff."],
        metric: "98%",
        primaryAction: "View travelers",
      }),
    ]);
    await Promise.all([
      writePng(baseline, "trip-planner__desktop.png", before),
      writePng(candidate, "trip-planner__desktop.png", after),
      writePng(candidate, "team-itinerary__desktop.png", added),
      writePng(baseline, "legacy-approvals__desktop.png", removed),
      writePng(baseline, "account__desktop.png", unchanged),
      writePng(candidate, "account__desktop.png", unchanged),
    ]);
    return await compareDirectories({ baseline, candidate, output });
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  generateMixedFixture()
    .then(() => console.log(`generated ${committedFixtureRoot}`))
    .catch((error) => {
      console.error(error instanceof Error ? error.stack : error);
      process.exitCode = 1;
    });
}
