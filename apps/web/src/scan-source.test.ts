import { describe, expect, test } from "vitest";

import { imageUrl, parseScanSource, reportUrl } from "./scan-source";

describe("scan source", () => {
  test("builds an immutable public report URL", () => {
    const source = parseScanSource(
      new URLSearchParams({
        ref: "0123456789abcdef0123456789abcdef01234567",
        repo: "dcramer/peated",
      }),
    );

    expect(source).not.toBeNull();
    expect(source).toMatchObject({ kind: "github" });
    expect(reportUrl(source!)).toBe(
      "https://raw.githubusercontent.com/dcramer/peated/0123456789abcdef0123456789abcdef01234567/report.json",
    );
  });

  test("rejects moving branch references", () => {
    expect(() =>
      parseScanSource(
        new URLSearchParams({ repo: "dcramer/peated", ref: "main" }),
      ),
    ).toThrow("full 40-character commit SHA");
  });

  test("builds a same-origin fixture URL", () => {
    const source = parseScanSource(new URLSearchParams({ fixture: "mixed" }));

    expect(source).toEqual({ kind: "fixture", name: "mixed" });
    expect(reportUrl(source!)).toBe("/mixed/report.json");
  });

  test("does not mix fixture and GitHub sources", () => {
    expect(() =>
      parseScanSource(
        new URLSearchParams({ fixture: "mixed", repo: "owner/repository" }),
      ),
    ).toThrow("not both");
  });

  test("loads a local report bundle from the development origin", () => {
    const source = parseScanSource(new URLSearchParams({ local: "1" }));

    expect(source).toEqual({ kind: "local" });
    expect(reportUrl(source!)).toBe("/report.json");
    expect(imageUrl(source!, "images/diff/home.png")).toBe(
      "/images/diff/home.png",
    );
  });

  test("does not mix local and remote report coordinates", () => {
    expect(() =>
      parseScanSource(
        new URLSearchParams({ local: "1", repo: "owner/repository" }),
      ),
    ).toThrow("Local report coordinates are invalid");
  });
});
