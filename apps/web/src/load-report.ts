import {
  parseVisualDiffReport,
  type VisualDiffReport,
} from "@frameshift/report";

import { reportUrl, type ScanSource } from "./scan-source";

const RETRY_DELAYS_MS = [250, 750, 1_500, 3_000];

type FetchReport = (input: string, init: RequestInit) => Promise<Response>;

interface LoadReportOptions {
  fetchReport?: FetchReport;
  retryDelays?: readonly number[];
  wait?: (delay: number) => Promise<void>;
}

function wait(delay: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delay));
}

function canRetryStatus(status: number): boolean {
  return status === 404 || status === 408 || status === 429 || status >= 500;
}

export async function loadReport(
  source: ScanSource,
  options: LoadReportOptions = {},
): Promise<VisualDiffReport> {
  const fetchReport = options.fetchReport ?? fetch;
  const retryDelays = options.retryDelays ?? RETRY_DELAYS_MS;
  const waitForRetry = options.wait ?? wait;

  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetchReport(reportUrl(source), { cache: "no-store" });
    } catch (error) {
      if (attempt >= retryDelays.length) throw error;
      await waitForRetry(retryDelays[attempt]);
      continue;
    }

    if (!response.ok) {
      const error = new Error(`Report request returned ${response.status}.`);
      if (!canRetryStatus(response.status) || attempt >= retryDelays.length) {
        throw error;
      }
      await waitForRetry(retryDelays[attempt]);
      continue;
    }

    return parseVisualDiffReport(await response.json());
  }
}
