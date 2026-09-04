import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const pages = [
  { canonical: "https://frameshift.pub/", file: "../index.html" },
  {
    canonical: "https://frameshift.pub/sample/",
    file: "../sample/index.html",
  },
  {
    canonical: "https://frameshift.pub/guide/",
    file: "../guide/index.html",
  },
];

describe("page metadata", () => {
  it.each(pages)("describes and shares $canonical", async (page) => {
    const html = await fs.readFile(new URL(page.file, import.meta.url), "utf8");

    expect(html).toContain('name="description"');
    expect(html).toContain('name="robots" content="index, follow"');
    expect(html).toContain(`rel="canonical" href="${page.canonical}"`);
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain(`property="og:url" content="${page.canonical}"`);
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain(
      'content="https://frameshift.pub/frameshift-social.png"',
    );
  });

  it("uses a 1200 by 630 social image", async () => {
    const image = await fs.readFile(
      new URL("./assets/frameshift-social.png", import.meta.url),
    );

    expect(image.subarray(1, 4).toString()).toBe("PNG");
    expect(image.readUInt32BE(16)).toBe(1200);
    expect(image.readUInt32BE(20)).toBe(630);
  });
});
