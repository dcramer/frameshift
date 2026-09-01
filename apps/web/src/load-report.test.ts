import { describe, expect, test, vi } from "vitest";

import { loadReport } from "./load-report";

const source = {
  kind: "github" as const,
  ref: "0123456789abcdef0123456789abcdef01234567",
  repo: "dcramer/peated",
};

const emptyReport = {
  files: [],
  summary: { added: 0, changed: 0, removed: 0, unchanged: 0 },
  version: 2,
};

describe("load report", () => {
  test("retries a report that is still propagating", async () => {
    const fetchReport = vi
      .fn<(input: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json(emptyReport));
    const wait = vi
      .fn<(delay: number) => Promise<void>>()
      .mockResolvedValue(undefined);

    await expect(
      loadReport(source, { fetchReport, retryDelays: [250], wait }),
    ).resolves.toEqual(emptyReport);

    expect(fetchReport).toHaveBeenCalledTimes(2);
    expect(fetchReport).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/dcramer/peated/0123456789abcdef0123456789abcdef01234567/report.json",
      { cache: "no-store" },
    );
    expect(wait).toHaveBeenCalledWith(250);
  });

  test("does not retry a permanent request error", async () => {
    const fetchReport = vi
      .fn<(input: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(new Response(null, { status: 400 }));
    const wait = vi
      .fn<(delay: number) => Promise<void>>()
      .mockResolvedValue(undefined);

    await expect(
      loadReport(source, { fetchReport, retryDelays: [250], wait }),
    ).rejects.toThrow("Report request returned 400.");

    expect(fetchReport).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
});
