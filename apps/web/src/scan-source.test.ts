import { describe, expect, test } from "vitest";

import { parseScanSource, reportUrl } from "./scan-source";

describe("scan source", () => {
  test("builds an immutable public report URL", () => {
    const source = parseScanSource(
      new URLSearchParams({
        ref: "0123456789abcdef0123456789abcdef01234567",
        repo: "dcramer/peated",
      }),
    );

    expect(source).not.toBeNull();
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
});
