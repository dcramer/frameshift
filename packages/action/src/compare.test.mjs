import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseVisualDiffReport } from "@frameshift/report";
import { PNG } from "pngjs";
import { afterEach, describe, expect, it } from "vitest";

import { compareDirectories } from "./compare.mjs";

const tempDirectories = [];

async function makeDirectories() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "frameshift-compare-"));
  tempDirectories.push(root);
  const baseline = path.join(root, "baseline");
  const candidate = path.join(root, "candidate");
  const output = path.join(root, "output");
  await Promise.all([
    fs.mkdir(baseline, { recursive: true }),
    fs.mkdir(candidate, { recursive: true }),
  ]);
  return { baseline, candidate, output };
}

async function writePng(
  file,
  { color = [255, 255, 255, 255], height = 2, width = 2 } = {},
) {
  const image = new PNG({ height, width });
  for (let index = 0; index < image.data.length; index += 4) {
    image.data.set(color, index);
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, PNG.sync.write(image));
}

async function writeRowPattern(file, rows) {
  const width = 64;
  const image = new PNG({ height: rows.length, width });
  for (const [row, sourceRow] of rows.entries()) {
    for (let column = 0; column < width; column += 1) {
      const offset = (row * width + column) * 4;
      if (sourceRow === null) {
        image.data.set([255, 0, 0, 255], offset);
        continue;
      }
      const value =
        (sourceRow * 73 + column * 151 + ((column * sourceRow) % 251)) % 256;
      image.data.set(
        [value, (value * 37) % 256, (value * 83) % 256, 255],
        offset,
      );
    }
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, PNG.sync.write(image));
}

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { force: true, recursive: true })),
  );
});

describe("compareDirectories", () => {
  it("keeps the output separate from input images", async () => {
    const paths = await makeDirectories();

    await expect(
      compareDirectories({ ...paths, output: paths.baseline }),
    ).rejects.toThrow("output folder outside the two screenshot folders");
  });

  it("writes the candidate image for matching pixels", async () => {
    const paths = await makeDirectories();
    await Promise.all([
      writePng(path.join(paths.baseline, "home.png")),
      writePng(path.join(paths.candidate, "home.png")),
    ]);

    const report = await compareDirectories(paths);

    expect(report.summary).toEqual({
      added: 0,
      changed: 0,
      removed: 0,
      unchanged: 1,
    });
    expect(report.files).toEqual([
      {
        file: "home.png",
        image: "images/candidate/home.png",
        images: { candidate: "images/candidate/home.png" },
        status: "unchanged",
      },
    ]);
    await expect(
      fs.stat(path.join(paths.output, "images/candidate/home.png")),
    ).resolves.toBeDefined();
  });

  it("writes a diff for changed pixels", async () => {
    const paths = await makeDirectories();
    await Promise.all([
      writePng(path.join(paths.baseline, "home.png")),
      writePng(path.join(paths.candidate, "home.png"), {
        color: [0, 0, 0, 255],
      }),
    ]);

    const report = await compareDirectories(paths);
    const diff = PNG.sync.read(
      await fs.readFile(path.join(paths.output, "images/diff/home.png")),
    );

    expect(report.version).toBe(2);
    expect(() => parseVisualDiffReport(report)).not.toThrow();
    expect(report.summary.changed).toBe(1);
    expect(report.files[0]).toMatchObject({
      file: "home.png",
      image: "images/diff/home.png",
      images: {
        baseline: "images/baseline/home.png",
        candidate: "images/candidate/home.png",
        diff: "images/diff/home.png",
      },
      status: "changed",
    });
    expect([...diff.data.subarray(0, 4)]).toEqual([255, 0, 255, 255]);
    await expect(
      fs.stat(path.join(paths.output, "images/baseline/home.png")),
    ).resolves.toBeDefined();
    await expect(
      fs.stat(path.join(paths.output, "images/candidate/home.png")),
    ).resolves.toBeDefined();
  });

  it("writes a diff for resized images", async () => {
    const paths = await makeDirectories();
    await Promise.all([
      writePng(path.join(paths.baseline, "nested/home.png")),
      writePng(path.join(paths.candidate, "nested/home.png"), { width: 3 }),
    ]);

    const report = await compareDirectories(paths);
    const diff = PNG.sync.read(
      await fs.readFile(path.join(paths.output, "images/diff/nested/home.png")),
    );

    expect(report.summary.changed).toBe(1);
    expect(report.files[0]).toMatchObject({
      file: "nested/home.png",
      height: 2,
      image: "images/diff/nested/home.png",
      images: {
        baseline: "images/baseline/nested/home.png",
        candidate: "images/candidate/nested/home.png",
        diff: "images/diff/nested/home.png",
      },
      status: "changed",
      width: 3,
    });
    expect({ height: diff.height, width: diff.width }).toEqual({
      height: 2,
      width: 3,
    });
    expect([...diff.data.subarray(8, 12)]).toEqual([255, 0, 255, 255]);
  });

  it("aligns content below one inserted row block", async () => {
    const paths = await makeDirectories();
    const baselineRows = Array.from({ length: 120 }, (_, index) => index);
    const candidateRows = [
      ...baselineRows.slice(0, 40),
      ...Array(8).fill(null),
      ...baselineRows.slice(40),
    ];
    await Promise.all([
      writeRowPattern(path.join(paths.baseline, "page.png"), baselineRows),
      writeRowPattern(path.join(paths.candidate, "page.png"), candidateRows),
    ]);

    const report = await compareDirectories(paths);
    const [candidate, diff] = await Promise.all([
      fs
        .readFile(path.join(paths.output, "images/candidate/page.png"))
        .then(PNG.sync.read),
      fs
        .readFile(path.join(paths.output, "images/diff/page.png"))
        .then(PNG.sync.read),
    ]);
    const insertedPixel = (40 * candidate.width + 10) * 4;
    const alignedPixel = (80 * candidate.width + 10) * 4;

    expect(report.summary.changed).toBe(1);
    expect({ height: diff.height, width: diff.width }).toEqual({
      height: 128,
      width: 64,
    });
    expect([
      ...diff.data.subarray(insertedPixel, insertedPixel + 4),
    ]).not.toEqual([
      ...candidate.data.subarray(insertedPixel, insertedPixel + 4),
    ]);
    expect([...diff.data.subarray(alignedPixel, alignedPixel + 4)]).toEqual([
      ...candidate.data.subarray(alignedPixel, alignedPixel + 4),
    ]);
  });

  it("copies added and removed images into the report", async () => {
    const paths = await makeDirectories();
    await Promise.all([
      writePng(path.join(paths.baseline, "removed.png")),
      writePng(path.join(paths.candidate, "added.png")),
    ]);

    const report = await compareDirectories(paths);

    expect(report.summary).toEqual({
      added: 1,
      changed: 0,
      removed: 1,
      unchanged: 0,
    });
    expect(report.files).toEqual([
      {
        file: "added.png",
        image: "images/candidate/added.png",
        images: { candidate: "images/candidate/added.png" },
        status: "added",
      },
      {
        file: "removed.png",
        image: "images/baseline/removed.png",
        images: { baseline: "images/baseline/removed.png" },
        status: "removed",
      },
    ]);
    await expect(
      fs.stat(path.join(paths.output, "images/candidate/added.png")),
    ).resolves.toBeDefined();
    await expect(
      fs.stat(path.join(paths.output, "images/baseline/removed.png")),
    ).resolves.toBeDefined();
  });
});
