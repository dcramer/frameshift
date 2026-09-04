import { describe, expect, it, vi } from "vitest";

import { serveReport } from "./server-report";

type FetchReport = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

const ref = "0123456789abcdef0123456789abcdef01234567";
const report = {
  files: [
    {
      file: "home.png",
      image: "images/candidate/home.png",
      images: { candidate: "images/candidate/home.png" },
      status: "unchanged",
    },
    {
      file: "settings/account__desktop.png",
      image: "images/diff/settings/account__desktop.png",
      images: {
        baseline: "images/baseline/settings/account__desktop.png",
        candidate: "images/candidate/settings/account__desktop.png",
        diff: "images/diff/settings/account__desktop.png",
      },
      status: "changed",
    },
  ],
  metadata: {
    pullRequest: {
      number: 13,
      title: 'Render <script>alert("unsafe")</script>',
    },
  },
  summary: { added: 0, changed: 1, removed: 0, unchanged: 1 },
  version: 2,
};

function reportRequest(params = "") {
  return new Request(
    `https://frameshift.pub/report/?repo=owner%2Frepo&ref=${ref}${params}`,
  );
}

describe("report pages", () => {
  it("includes the selected screenshot and browser data", async () => {
    const fetchReport = vi.fn<FetchReport>(async () =>
      Response.json(report, { headers: { "Content-Length": "1200" } }),
    );
    const expires = 1_800_086_400;
    const response = await serveReport(
      reportRequest(`&expires=${expires}&file=settings%2Faccount__desktop.png`),
      { fetchReport, now: 1_800_000_000_000 },
    );
    const html = await response.text();

    expect(fetchReport).toHaveBeenCalledWith(
      `https://raw.githubusercontent.com/owner/repo/${ref}/report.json`,
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(response.headers.get("vercel-cdn-cache-control")).toBe(
      "public, max-age=86400, immutable",
    );
    expect(html).toContain("settings · account · desktop");
    expect(html).toContain(
      `https://raw.githubusercontent.com/owner/repo/${ref}/images/diff/settings/account__desktop.png`,
    );
    expect(html).toContain("file=home.png");
    expect(html).toContain('id="frameshift-report-data"');
    expect(html).toContain('src="/assets/client.js"');
    expect(html).toContain('href="/assets/main.css"');
    expect(html).toContain(
      'name="robots" content="noindex, nofollow, noarchive"',
    );
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).not.toContain('<script>alert("unsafe")');
    expect(html).toContain("\\u003cscript\\u003ealert");
  });

  it("uses a short cache for old links without an expiration", async () => {
    const response = await serveReport(reportRequest(), {
      fetchReport: async () => Response.json(report),
    });

    expect(response.headers.get("vercel-cdn-cache-control")).toBe(
      "public, max-age=3600, immutable",
    );
  });

  it("does not cache invalid report requests", async () => {
    const fetchReport = vi.fn<FetchReport>();
    const response = await serveReport(
      new Request("https://frameshift.pub/report/?repo=owner%2Frepo&ref=main"),
      { fetchReport },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchReport).not.toHaveBeenCalled();
    expect(await response.text()).toContain(
      "Use the full 40-character Git commit ID",
    );
  });

  it("rejects oversized reports before parsing them", async () => {
    const response = await serveReport(reportRequest(), {
      fetchReport: async () =>
        new Response("{}", {
          headers: { "Content-Length": "5000001" },
        }),
    });

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain("The report is too large.");
  });

  it("stops reading a report when the server omits its size", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(4_000_000));
        controller.enqueue(new Uint8Array(1_000_001));
      },
    });
    const response = await serveReport(reportRequest(), {
      fetchReport: async () => new Response(body),
    });

    expect(response.status).toBe(502);
    expect(await response.text()).toContain("The report is too large.");
  });
});
