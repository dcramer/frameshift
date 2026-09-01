import { describe, expect, test, vi } from "vitest";

import { readBrowserReport, type BrowserReportFile } from "./browser-report";
import { imageUrl } from "./scan-source";

const unchangedReport = {
  files: [
    {
      file: "home.png",
      image: "images/candidate/home.png",
      images: { candidate: "images/candidate/home.png" },
      status: "unchanged",
    },
  ],
  summary: { added: 0, changed: 0, removed: 0, unchanged: 1 },
  version: 2,
};

const changedReport = {
  files: [
    {
      file: "home.png",
      image: "images/diff/home.png",
      images: {
        baseline: "images/baseline/home.png",
        candidate: "images/candidate/home.png",
        diff: "images/diff/home.png",
      },
      status: "changed",
    },
  ],
  summary: { added: 0, changed: 1, removed: 0, unchanged: 0 },
  version: 2,
};

function selectedFile(path: string, contents = ""): BrowserReportFile {
  return {
    name: path.split("/").at(-1)!,
    text: async () => contents,
    webkitRelativePath: path,
  };
}

describe("browser report", () => {
  test("opens a complete report folder and releases its image URLs", async () => {
    const files = [
      selectedFile("scan/report.json", JSON.stringify(changedReport)),
      selectedFile("scan/images/baseline/home.png"),
      selectedFile("scan/images/candidate/home.png"),
      selectedFile("scan/images/diff/home.png"),
    ];
    const create = vi.fn<(file: BrowserReportFile) => string>(
      (file) => `blob:${file.name}`,
    );
    const revoke = vi.fn<(url: string) => void>();

    const result = await readBrowserReport(files, { create, revoke });

    expect(result.report.summary.changed).toBe(1);
    expect(imageUrl(result.source, "images/diff/home.png")).toBe(
      "blob:home.png",
    );
    expect(create).toHaveBeenCalledTimes(3);

    result.dispose();
    expect(revoke).toHaveBeenCalledTimes(3);
  });

  test("opens an unchanged screenshot", async () => {
    const result = await readBrowserReport(
      [
        selectedFile("scan/report.json", JSON.stringify(unchangedReport)),
        selectedFile("scan/images/candidate/home.png"),
      ],
      {
        create: (file) => `blob:${file.name}`,
        revoke: () => undefined,
      },
    );

    expect(result.report.summary.unchanged).toBe(1);
    expect(imageUrl(result.source, "images/candidate/home.png")).toBe(
      "blob:home.png",
    );
    expect(result.source).toMatchObject({ kind: "browser" });
    result.dispose();
  });

  test("rejects an incomplete report folder", async () => {
    await expect(
      readBrowserReport([
        selectedFile("scan/report.json", JSON.stringify(changedReport)),
        selectedFile("scan/images/diff/home.png"),
      ]),
    ).rejects.toThrow("missing images/baseline/home.png and 1 more");
  });

  test("rejects invalid report JSON", async () => {
    await expect(
      readBrowserReport([selectedFile("scan/report.json", "not JSON")]),
    ).rejects.toThrow("report.json is not valid JSON");
  });

  test("requires exactly one report folder", async () => {
    await expect(
      readBrowserReport([
        selectedFile("first/report.json", JSON.stringify(unchangedReport)),
        selectedFile("second/report.json", JSON.stringify(unchangedReport)),
      ]),
    ).rejects.toThrow("one report folder at a time");
  });
});
