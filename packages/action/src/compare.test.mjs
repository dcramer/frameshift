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

function linearChannel(value) {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function srgbChannel(value) {
  const channel =
    value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.round(channel * 255);
}

async function writeGlyph(
  file,
  { color = [176, 200, 224], letter = "E", x = 12 } = {},
) {
  const background = [20, 24, 28];
  const image = new PNG({ height: 32, width: 48 });
  const rectangles = [
    { height: 16, width: 2, x, y: 8 },
    { height: 2, width: 10, x, y: 8 },
    { height: 2, width: letter === "E" ? 8 : 10, x, y: 15 },
    ...(letter === "E" ? [{ height: 2, width: 10, x, y: 22 }] : []),
    ...(letter === "F" ? [{ height: 6, width: 2, x: x + 8, y: 18 }] : []),
  ];

  for (let row = 0; row < image.height; row += 1) {
    for (let column = 0; column < image.width; column += 1) {
      const coverage = Math.max(
        0,
        ...rectangles.map((rectangle) => {
          const horizontal = Math.max(
            0,
            Math.min(column + 1, rectangle.x + rectangle.width) -
              Math.max(column, rectangle.x),
          );
          const vertical = Math.max(
            0,
            Math.min(row + 1, rectangle.y + rectangle.height) -
              Math.max(row, rectangle.y),
          );
          return horizontal * vertical;
        }),
      );
      const offset = (row * image.width + column) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const mixed =
          linearChannel(background[channel]) * (1 - coverage) +
          linearChannel(color[channel]) * coverage;
        image.data[offset + channel] = srgbChannel(mixed);
      }
      image.data[offset + 3] = 255;
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

  it("suppresses low-contrast surface rendering drift", async () => {
    const paths = await makeDirectories();
    await Promise.all([
      writePng(path.join(paths.baseline, "home.png"), {
        color: [247, 248, 245, 255],
      }),
      writePng(path.join(paths.candidate, "home.png"), {
        color: [235, 238, 231, 255],
      }),
    ]);

    const report = await compareDirectories(paths);

    expect(report.summary).toEqual({
      added: 0,
      changed: 0,
      removed: 0,
      unchanged: 1,
    });
  });

  it("includes optional report metadata", async () => {
    const paths = await makeDirectories();
    const metadata = {
      pullRequest: {
        number: 42,
        title: "Make group trips easier to plan",
      },
    };

    const report = await compareDirectories({ ...paths, metadata });

    expect(report.metadata).toEqual(metadata);
    await expect(
      fs
        .readFile(path.join(paths.output, "report.json"), "utf8")
        .then(JSON.parse),
    ).resolves.toMatchObject({ metadata });
    expect(() => parseVisualDiffReport(report)).not.toThrow();
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

  it("treats a quarter-pixel glyph shift as unchanged", async () => {
    const paths = await makeDirectories();
    await Promise.all([
      writeGlyph(path.join(paths.baseline, "label.png")),
      writeGlyph(path.join(paths.candidate, "label.png"), { x: 12.25 }),
    ]);

    const report = await compareDirectories(paths);

    expect(report.summary.unchanged).toBe(1);
    await expect(
      fs.stat(path.join(paths.output, "images/diff/label.png")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    ["a whole-pixel move", { x: 13 }],
    ["new ink color", { color: [224, 176, 200] }],
    ["a different letter", { letter: "F" }],
  ])("keeps %s as changed", async (_name, candidateOptions) => {
    const paths = await makeDirectories();
    await Promise.all([
      writeGlyph(path.join(paths.baseline, "label.png")),
      writeGlyph(path.join(paths.candidate, "label.png"), candidateOptions),
    ]);

    const report = await compareDirectories(paths);

    expect(report.summary.changed).toBe(1);
    await expect(
      fs.stat(path.join(paths.output, "images/diff/label.png")),
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

  it("shows current screenshots as added when the baseline is empty", async () => {
    const paths = await makeDirectories();
    await writePng(path.join(paths.candidate, "current.png"));

    const report = await compareDirectories(paths);

    expect(report.summary).toEqual({
      added: 1,
      changed: 0,
      removed: 0,
      unchanged: 0,
    });
    expect(report.files[0]).toMatchObject({
      file: "current.png",
      images: { candidate: "images/candidate/current.png" },
      status: "added",
    });
  });
});
