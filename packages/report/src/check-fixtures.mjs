#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseVisualDiffReport } from "./index.ts";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixturesRoot = path.resolve(packageRoot, "../../fixtures");

async function listPngs(root, directory = root) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listPngs(root, absolute)));
    } else if (entry.isFile() && entry.name.endsWith(".png")) {
      files.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  }
  return files;
}

async function checkFixture(fixtureRoot) {
  const report = parseVisualDiffReport(
    JSON.parse(
      await fs.readFile(path.join(fixtureRoot, "report.json"), "utf8"),
    ),
  );
  const referencedImages = report.files
    .flatMap((file) =>
      file.status === "unchanged" ? [] : Object.values(file.images),
    )
    .toSorted();

  await Promise.all(
    referencedImages.map((image) =>
      fs.access(path.join(fixtureRoot, ...image.split("/"))),
    ),
  );

  const fixtureImages = (await listPngs(fixtureRoot)).toSorted();
  if (JSON.stringify(fixtureImages) !== JSON.stringify(referencedImages)) {
    throw new Error(
      `${path.basename(fixtureRoot)} contains missing or unreferenced PNG files`,
    );
  }
}

const fixtures = (await fs.readdir(fixturesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .toSorted();
if (fixtures.length === 0) throw new Error("No visual diff fixtures found");

for (const fixture of fixtures) {
  await checkFixture(path.join(fixturesRoot, fixture));
}
console.log(`validated ${fixtures.length} visual diff fixture(s)`);
