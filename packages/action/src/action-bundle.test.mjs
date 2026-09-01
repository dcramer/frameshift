import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { copyHoneydiffAssets } from "./copy-honeydiff-assets.mjs";
import { runActionSmoke } from "./smoke.mjs";

const DIFF_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = path.resolve(DIFF_DIR, "..");
const REPOSITORY_DIR = path.resolve(PACKAGE_DIR, "../..");
const ACTION_DIR = path.join(REPOSITORY_DIR, "dist");
const PUBLISH_ACTION_DIR = path.join(REPOSITORY_DIR, "publish/dist");
const NCC = fileURLToPath(import.meta.resolve("@vercel/ncc/dist/ncc/cli.js"));
const VITE = fileURLToPath(
  new URL("bin/vite.js", import.meta.resolve("vite/package.json")),
);
const tempDirectories = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { force: true, recursive: true })),
  );
});

describe("built screenshot comparison Action", () => {
  it("matches the source and includes license notices", async () => {
    const output = await fs.mkdtemp(
      path.join(os.tmpdir(), "frameshift-action-"),
    );
    tempDirectories.push(output);
    execFileSync(
      process.execPath,
      [
        NCC,
        "build",
        path.join(DIFF_DIR, "action.mjs"),
        "-o",
        output,
        "--minify",
        "--license",
        "THIRD_PARTY_LICENSES.txt",
      ],
      { cwd: PACKAGE_DIR, stdio: "pipe" },
    );
    await copyHoneydiffAssets(output);

    for (const file of [
      "index.mjs",
      "load-platform.cjs",
      "package.json",
      "THIRD_PARTY_LICENSES.txt",
    ]) {
      const [actual, expected] = await Promise.all([
        fs.readFile(path.join(ACTION_DIR, file), "utf8"),
        fs.readFile(path.join(output, file), "utf8"),
      ]);
      expect(actual, `${file} is out of date`).toBe(expected);
    }

    const [actualPlatforms, platforms] = await Promise.all([
      fs.readdir(path.join(ACTION_DIR, "platforms")),
      fs.readdir(path.join(output, "platforms")),
    ]);
    expect(actualPlatforms, "platform file list is out of date").toEqual(
      platforms,
    );
    for (const file of platforms) {
      const [actual, expected] = await Promise.all([
        fs.readFile(path.join(ACTION_DIR, "platforms", file)),
        fs.readFile(path.join(output, "platforms", file)),
      ]);
      expect(actual.equals(expected), `platforms/${file} is out of date`).toBe(
        true,
      );
    }
  }, 60_000);

  it("runs without installed dependencies and writes the changes output", async () => {
    await expect(runActionSmoke()).resolves.toEqual({
      changes: 3,
      summary: {
        added: 1,
        changed: 1,
        removed: 1,
        unchanged: 0,
      },
    });
  }, 60_000);
});

describe("built report publishing Action", () => {
  it("matches the source", async () => {
    const output = await fs.mkdtemp(
      path.join(os.tmpdir(), "frameshift-publisher-action-"),
    );
    tempDirectories.push(output);
    execFileSync(
      process.execPath,
      [
        VITE,
        "build",
        "--config",
        path.join(PACKAGE_DIR, "vite.publish.config.ts"),
        "--outDir",
        output,
      ],
      { cwd: PACKAGE_DIR, stdio: "pipe" },
    );

    const [actual, expected] = await Promise.all([
      fs.readFile(path.join(PUBLISH_ACTION_DIR, "index.mjs"), "utf8"),
      fs.readFile(path.join(output, "index.mjs"), "utf8"),
    ]);
    expect(actual, "publish/dist/index.mjs is out of date").toBe(expected);
  }, 60_000);
});
