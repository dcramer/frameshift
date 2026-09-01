import { describe, expect, test } from "vitest";
import { ZodError } from "zod";

import {
  parseVisualDiffReport,
  safeParseVisualDiffReport,
  visualDiffReportV1JsonSchema,
} from "./index.js";

const changedFile = {
  file: "home__desktop.png",
  image: "images/diff/home__desktop.png",
  images: {
    baseline: "images/baseline/home__desktop.png",
    candidate: "images/candidate/home__desktop.png",
    diff: "images/diff/home__desktop.png",
  },
  status: "changed",
} as const;

function report(files: unknown[]) {
  const summary = { added: 0, changed: 0, removed: 0, unchanged: 0 };
  for (const file of files) {
    if (
      typeof file === "object" &&
      file !== null &&
      "status" in file &&
      typeof file.status === "string" &&
      file.status in summary
    ) {
      summary[file.status as keyof typeof summary] += 1;
    }
  }
  return { files, summary, version: 1 };
}

describe("parseVisualDiffReport", () => {
  test("parses a strict version 1 report", () => {
    expect(
      parseVisualDiffReport(
        report([changedFile, { file: "search.png", status: "unchanged" }]),
      ),
    ).toMatchObject({
      summary: { added: 0, changed: 1, removed: 0, unchanged: 1 },
      version: 1,
    });
  });

  test("returns structured Zod issues", () => {
    const result = safeParseVisualDiffReport({ version: 2 });
    const error = result.success ? undefined : result.error;

    expect(result.success).toBe(false);
    expect(error).toBeInstanceOf(ZodError);
    expect(error?.issues.map((issue) => issue.path)).toContainEqual([
      "version",
    ]);
  });

  test("rejects path traversal", () => {
    expect(() =>
      parseVisualDiffReport(
        report([{ ...changedFile, file: "../secret.png" }]),
      ),
    ).toThrow("Expected a safe relative PNG path");
  });

  test("rejects images that do not match the status", () => {
    expect(() =>
      parseVisualDiffReport(
        report([
          {
            file: "new.png",
            image: "images/candidate/new.png",
            images: {
              baseline: "images/baseline/new.png",
              candidate: "images/candidate/new.png",
            },
            status: "added",
          },
        ]),
      ),
    ).toThrow(ZodError);
  });

  test("rejects a primary image that does not match its image set", () => {
    expect(() =>
      parseVisualDiffReport(
        report([
          {
            ...changedFile,
            image: "images/diff/another.png",
          },
        ]),
      ),
    ).toThrow("Primary image must match");
  });

  test("rejects an incorrect summary", () => {
    expect(() =>
      parseVisualDiffReport({
        ...report([changedFile]),
        summary: { added: 0, changed: 0, removed: 0, unchanged: 0 },
      }),
    ).toThrow("Expected 1 changed files");
  });

  test("exports a strict JSON Schema for external producers", () => {
    expect(visualDiffReportV1JsonSchema()).toMatchObject({
      $id: expect.stringContaining("report-v1.schema.json"),
      additionalProperties: false,
      properties: { version: { const: 1, type: "number" } },
      required: ["files", "summary", "version"],
    });
  });
});
