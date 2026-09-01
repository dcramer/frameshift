import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  committedFixtureRoot,
  generateMixedFixture,
} from "./generate-fixture.mjs";

const tempDirectories = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      fs.rm(directory, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

async function listFiles(root, directory = root) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, absolute)));
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolute));
    }
  }
  return files.toSorted();
}

describe("mixed visual diff fixture", () => {
  test("matches the current comparison output", async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "frameshift-fixture-test-"),
    );
    tempDirectories.push(tempRoot);
    const generatedRoot = path.join(tempRoot, "mixed");
    await generateMixedFixture(generatedRoot);

    const expectedFiles = await listFiles(committedFixtureRoot);
    expect(await listFiles(generatedRoot)).toEqual(expectedFiles);
    for (const file of expectedFiles) {
      await expect(
        fs.readFile(path.join(generatedRoot, file)),
      ).resolves.toEqual(
        await fs.readFile(path.join(committedFixtureRoot, file)),
      );
    }
  }, 30_000);
});
