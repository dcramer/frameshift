import { describe, expect, test } from "vitest";

import { buildComment, buildViewerUrl } from "./publish.mjs";

function report(summary) {
  return { files: [], summary, version: 1 };
}

describe("Frameshift publisher", () => {
  test("builds a compact comment with only the summary and review link", () => {
    const body = buildComment(
      report({ added: 1, changed: 2, removed: 1, unchanged: 3 }),
      "https://frameshift.pub/?repo=owner%2Frepo&ref=abc",
    );

    expect(body).toContain(
      "**4 visual changes** — 2 changed · 1 added · 1 removed",
    );
    expect(body).toContain("[Review the visual report in Frameshift]");
    expect(body).not.toContain("![");
    expect(body).not.toContain(".png");
  });

  test("reports no visual changes", () => {
    const body = buildComment(
      report({ added: 0, changed: 0, removed: 0, unchanged: 3 }),
      "https://frameshift.pub/",
    );

    expect(body).toContain("**No visual changes**");
  });

  test("builds the immutable viewer URL", () => {
    expect(
      buildViewerUrl("https://frameshift.pub/", "owner/repo", "abc123"),
    ).toBe("https://frameshift.pub/?ref=abc123&repo=owner%2Frepo");
  });
});
