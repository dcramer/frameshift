import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { checkReportDirectory } from "./directory.ts";

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

async function makeReport(files = []) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "frameshift-report-"));
  tempDirectories.push(root);
  const summary = { added: 0, changed: 0, removed: 0, unchanged: 0 };
  for (const file of files) {
    if (
      typeof file === "object" &&
      file !== null &&
      "status" in file &&
      typeof file.status === "string" &&
      file.status in summary
    ) {
      summary[file.status] += 1;
    }
  }
  await fs.writeFile(
    path.join(root, "report.json"),
    `${JSON.stringify({ files, summary, version: 2 })}\n`,
  );
  return root;
}

describe("checkReportDirectory", () => {
  test("accepts a complete report folder", async () => {
    const root = await makeReport();

    await expect(checkReportDirectory(root)).resolves.toMatchObject({
      summary: { added: 0, changed: 0, removed: 0, unchanged: 0 },
      version: 2,
    });
  });

  test("rejects files that are not part of the report", async () => {
    const root = await makeReport();
    await fs.writeFile(path.join(root, "secret.txt"), "not public");

    await expect(checkReportDirectory(root)).rejects.toThrow(
      "unexpected secret.txt",
    );
  });

  test("rejects missing report images", async () => {
    const root = await makeReport([
      {
        file: "home.png",
        image: "images/candidate/home.png",
        images: { candidate: "images/candidate/home.png" },
        status: "added",
      },
    ]);

    await expect(checkReportDirectory(root)).rejects.toThrow(
      "missing images/candidate/home.png",
    );
  });

  test("requires candidate images for unchanged screenshots", async () => {
    const root = await makeReport([
      {
        file: "home.png",
        image: "images/candidate/home.png",
        images: { candidate: "images/candidate/home.png" },
        status: "unchanged",
      },
    ]);

    await expect(checkReportDirectory(root)).rejects.toThrow(
      "missing images/candidate/home.png",
    );
  });
});
