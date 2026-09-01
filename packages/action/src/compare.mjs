#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

import { compare, getDimensions } from "@vizzly-testing/honeydiff";
import { PNG } from "pngjs";

const REPORT_VERSION = 1;
const COMPARISON_OPTIONS = {
  alignHeightChanges: true,
  antialiasing: true,
  minimumRegionPixels: 2,
  threshold: 2,
};

async function listPngs(root) {
  const files = new Map();

  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile() && entry.name.endsWith(".png")) {
        const relative = path
          .relative(root, absolute)
          .split(path.sep)
          .join("/");
        files.set(relative, absolute);
      }
    }
  }

  await visit(root);
  return files;
}

function fitWidth(image, width) {
  if (image.width === width) return image;

  const result = new PNG({ height: image.height, width });
  result.data.fill(0);
  for (let row = 0; row < image.height; row += 1) {
    const start = row * image.width * 4;
    image.data.copy(
      result.data,
      row * width * 4,
      start,
      start + image.width * 4,
    );
  }
  return result;
}

async function comparisonInputs(baselinePath, candidatePath) {
  const [baselineSize, candidateSize] = await Promise.all([
    getDimensions(baselinePath),
    getDimensions(candidatePath),
  ]);
  if (baselineSize.width === candidateSize.width) {
    return [baselinePath, candidatePath];
  }

  const width = Math.max(baselineSize.width, candidateSize.width);
  const [baseline, candidate] = await Promise.all([
    fs.readFile(baselinePath).then(PNG.sync.read),
    fs.readFile(candidatePath).then(PNG.sync.read),
  ]);
  return [
    PNG.sync.write(fitWidth(baseline, width)),
    PNG.sync.write(fitWidth(candidate, width)),
  ];
}

async function copyReportImage(source, output, kind, relative) {
  const destination = path.join(output, "images", kind, ...relative.split("/"));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
  return `images/${kind}/${relative}`;
}

async function comparePair(baselinePath, candidatePath, output, relative) {
  const diffImage = path.join(output, "images", "diff", ...relative.split("/"));
  await fs.mkdir(path.dirname(diffImage), { recursive: true });
  const [baselineInput, candidateInput] = await comparisonInputs(
    baselinePath,
    candidatePath,
  );
  const analysis = await compare(
    baselineInput,
    candidateInput,
    COMPARISON_OPTIONS,
    {
      color: "#ff00ff",
      diffPath: diffImage,
      overwrite: true,
    },
  );

  if (!analysis.different) {
    await fs.rm(diffImage, { force: true });
    return { file: relative, status: "unchanged" };
  }

  const { height, width } = analysis.images.canvas;
  const [baselineImage, candidateImage] = await Promise.all([
    copyReportImage(baselinePath, output, "baseline", relative),
    copyReportImage(candidatePath, output, "candidate", relative),
  ]);
  return {
    file: relative,
    height,
    image: `images/diff/${relative}`,
    images: {
      baseline: baselineImage,
      candidate: candidateImage,
      diff: `images/diff/${relative}`,
    },
    status: "changed",
    width,
  };
}

export async function compareDirectories({ baseline, candidate, output }) {
  for (const input of [baseline, candidate]) {
    const relative = path.relative(input, output);
    const reverse = path.relative(output, input);
    const overlaps =
      relative === "" ||
      reverse === "" ||
      (!relative.startsWith("..") && !path.isAbsolute(relative)) ||
      (!reverse.startsWith("..") && !path.isAbsolute(reverse));
    if (overlaps) {
      throw new Error(
        "Output directory must be separate from input directories",
      );
    }
  }

  const [baselineFiles, candidateFiles] = await Promise.all([
    listPngs(baseline),
    listPngs(candidate),
  ]);
  const names = [
    ...new Set([...baselineFiles.keys(), ...candidateFiles.keys()]),
  ].toSorted((left, right) => left.localeCompare(right));

  await fs.rm(output, { force: true, recursive: true });
  await fs.mkdir(output, { recursive: true });

  const files = [];
  for (const file of names) {
    const baselinePath = baselineFiles.get(file);
    const candidatePath = candidateFiles.get(file);
    if (!baselinePath) {
      const candidateImage = await copyReportImage(
        candidatePath,
        output,
        "candidate",
        file,
      );
      files.push({
        file,
        image: candidateImage,
        images: {
          candidate: candidateImage,
        },
        status: "added",
      });
    } else if (!candidatePath) {
      const baselineImage = await copyReportImage(
        baselinePath,
        output,
        "baseline",
        file,
      );
      files.push({
        file,
        image: baselineImage,
        images: {
          baseline: baselineImage,
        },
        status: "removed",
      });
    } else {
      files.push(await comparePair(baselinePath, candidatePath, output, file));
    }
  }

  const summary = { added: 0, changed: 0, removed: 0, unchanged: 0 };
  for (const file of files) summary[file.status] += 1;
  const report = { files, summary, version: REPORT_VERSION };
  await fs.writeFile(
    path.join(output, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report;
}
