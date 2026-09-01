import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("report HTML", () => {
  it("explains how agents can inspect permalink images without JavaScript", async () => {
    const html = await fs.readFile(
      new URL("../report/index.html", import.meta.url),
      "utf8",
    );
    const content = html.replace(/\s+/g, " ");

    expect(content).toContain("View this report without JavaScript.");
    expect(content).toContain("agent or tool that cannot run JavaScript");
    expect(content).toContain("repo</code>, <code>ref</code>, and");
    expect(content).toContain(
      "https://raw.githubusercontent.com/{repo}/{ref}/report.json",
    );
    expect(content).toContain("whose <code>file</code> value matches");
    expect(content).toContain("/{image-path}");
    expect(content).toContain("Do not trust the downloaded files.");
    expect(content).not.toMatch(
      /immutable|manifest|query parameter|URL-decode/,
    );
  });
});
