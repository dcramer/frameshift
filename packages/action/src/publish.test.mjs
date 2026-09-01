import { describe, expect, test } from "vitest";

import { buildComment, buildViewerUrl } from "./publish.mjs";

function report(summary) {
  return { files: [], summary, version: 1 };
}

function changedFile(file) {
  return {
    file,
    image: `images/diff/${file}`,
    images: {
      baseline: `images/baseline/${file}`,
      candidate: `images/candidate/${file}`,
      diff: `images/diff/${file}`,
    },
    status: "changed",
  };
}

describe("Frameshift publisher", () => {
  test("builds a compact summary and candidate thumbnail grid", () => {
    const visualReport = report({
      added: 1,
      changed: 2,
      removed: 1,
      unchanged: 3,
    });
    visualReport.files = [
      changedFile("home__desktop.png"),
      changedFile("home__mobile.png"),
    ];
    const body = buildComment(
      visualReport,
      "https://frameshift.pub/?repo=owner%2Frepo&ref=abc",
      "https://raw.githubusercontent.com/owner/repo/abc",
    );

    expect(body).toContain(
      "**4 visual changes** — 2 changed · 1 added · 1 removed",
    );
    expect(body).toContain("[Review the visual report in Frameshift]");
    expect(body).toContain("<table>");
    expect(body).toContain('width="180"');
    expect(body).toContain("Home · Desktop");
    expect(body).toContain(
      "https://raw.githubusercontent.com/owner/repo/abc/images/candidate/home__desktop.png",
    );
    expect(body).not.toContain("images/baseline");
    expect(body).not.toContain("images/diff");
    expect(body).not.toContain("![");
  });

  test("puts thumbnails after the first six in a disclosure", () => {
    const files = Array.from({ length: 8 }, (_, index) =>
      changedFile(`page-${index + 1}__desktop.png`),
    );
    const body = buildComment(
      {
        files,
        summary: { added: 0, changed: 8, removed: 0, unchanged: 0 },
        version: 1,
      },
      "https://frameshift.pub/?repo=owner%2Frepo&ref=abc",
      "https://raw.githubusercontent.com/owner/repo/abc",
    );

    expect(body).toContain(
      "<summary>Show 2 more changed screenshots</summary>",
    );
    expect(body.match(/<img /g)).toHaveLength(8);
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
