import { describe, expect, test } from "vitest";

import {
  imageUrl,
  pageSource,
  parseScanSource,
  reportUrl,
} from "./scan-source";

describe("scan source", () => {
  test("loads the mixed sample from the sample route", () => {
    expect(pageSource("/sample/", new URLSearchParams())).toEqual({
      kind: "fixture",
      name: "mixed",
    });
  });

  test("builds a public report URL from a full commit ID", () => {
    const source = pageSource(
      "/report/",
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
    ).toThrow("full 40-character Git commit ID");
  });

  test("builds a same-origin sample URL", () => {
    const source = parseScanSource(new URLSearchParams({ fixture: "mixed" }));

    expect(source).toEqual({ kind: "fixture", name: "mixed" });
    expect(reportUrl(source!)).toBe("/mixed/report.json");
  });

  test("does not mix sample and GitHub sources", () => {
    expect(() =>
      parseScanSource(
        new URLSearchParams({ fixture: "mixed", repo: "owner/repository" }),
      ),
    ).toThrow("not both");
  });

  test("loads a local report folder from the development origin", () => {
    const source = parseScanSource(new URLSearchParams({ local: "1" }));

    expect(source).toEqual({ kind: "local" });
    expect(reportUrl(source!)).toBe("/report.json");
    expect(imageUrl(source!, "images/diff/home.png")).toBe(
      "/images/diff/home.png",
    );
  });

  test("does not mix local and GitHub report URLs", () => {
    expect(() =>
      parseScanSource(
        new URLSearchParams({ local: "1", repo: "owner/repository" }),
      ),
    ).toThrow("local report URL is invalid");
  });
});
