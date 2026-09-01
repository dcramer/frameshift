#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

import { compareDirectories } from "./compare.mjs";

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));
export const committedFixtureRoot = path.resolve(
  sourceRoot,
  "../../../fixtures/mixed",
);
const width = 720;
const height = 420;

function fill(image, x, y, rectangleWidth, rectangleHeight, color) {
  for (let row = y; row < y + rectangleHeight; row += 1) {
    for (let column = x; column < x + rectangleWidth; column += 1) {
      image.data.set(color, (row * image.width + column) * 4);
    }
  }
}

function frame({ accent, cards = 3, variant = "default" }) {
  const image = new PNG({ height, width });
  fill(image, 0, 0, width, height, [5, 9, 13, 255]);
  fill(image, 0, 0, width, 54, [10, 25, 30, 255]);
  fill(image, 18, 16, 156, 20, accent);
  fill(image, 20, 76, 150, 320, [10, 29, 34, 255]);
  fill(image, 190, 76, 510, 64, [12, 36, 41, 255]);

  const cardWidth = variant === "expanded" ? 238 : 156;
  for (let index = 0; index < cards; index += 1) {
    const column = index % (variant === "expanded" ? 2 : 3);
    const row = Math.floor(index / (variant === "expanded" ? 2 : 3));
    const x = 190 + column * (cardWidth + 18);
    const y = 158 + row * 116;
    fill(image, x, y, cardWidth, 96, [12, 30, 35, 255]);
    fill(
      image,
      x,
      y,
      cardWidth,
      4,
      index === cards - 1 ? accent : [31, 76, 79, 255],
    );
    fill(
      image,
      x + 16,
      y + 24,
      Math.min(86 + index * 12, cardWidth - 32),
      10,
      [96, 137, 138, 255],
    );
    fill(image, x + 16, y + 50, cardWidth - 32, 24, [17, 49, 53, 255]);
  }
  return image;
}

async function writePng(root, relative, image) {
  const destination = path.join(root, ...relative.split("/"));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, PNG.sync.write(image));
}

export async function generateMixedFixture(output = committedFixtureRoot) {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "scanner-sweep-fixture-"),
  );
  const baseline = path.join(tempRoot, "baseline");
  const candidate = path.join(tempRoot, "candidate");

  try {
    await Promise.all([fs.mkdir(baseline), fs.mkdir(candidate)]);
    const unchanged = frame({ accent: [89, 221, 209, 255], cards: 3 });
    await Promise.all([
      writePng(
        baseline,
        "dashboard__desktop.png",
        frame({ accent: [89, 221, 209, 255], cards: 3 }),
      ),
      writePng(
        candidate,
        "dashboard__desktop.png",
        frame({
          accent: [255, 196, 102, 255],
          cards: 4,
          variant: "expanded",
        }),
      ),
      writePng(
        candidate,
        "activity__desktop.png",
        frame({ accent: [105, 226, 154, 255], cards: 2 }),
      ),
      writePng(
        baseline,
        "legacy-settings__desktop.png",
        frame({ accent: [255, 123, 115, 255], cards: 1 }),
      ),
      writePng(baseline, "profile__desktop.png", unchanged),
      writePng(candidate, "profile__desktop.png", unchanged),
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
