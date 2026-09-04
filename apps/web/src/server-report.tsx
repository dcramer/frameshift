import { parseVisualDiffReport } from "@frameshift/report";
import { renderToString } from "react-dom/server";

import { ReportPage } from "./App";
import { readReportView } from "./report-view";
import { parseScanSource, reportUrl } from "./scan-source";

const DEFAULT_CACHE_SECONDS = 60 * 60;
const MAX_CACHE_SECONDS = 365 * 24 * 60 * 60;
const MAX_REPORT_BYTES = 5_000_000;

type FetchReport = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

interface ServerReportOptions {
  fetchReport?: FetchReport;
  now?: number;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function serializeReport(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function cacheSeconds(params: URLSearchParams, now: number) {
  const expires = params.get("expires");
  if (!expires || !/^[1-9][0-9]*$/.test(expires)) {
    return DEFAULT_CACHE_SECONDS;
  }
  const remaining = Math.floor(Number(expires) - now / 1000);
  if (!Number.isSafeInteger(remaining) || remaining < 1) return 1;
  return Math.min(remaining, MAX_CACHE_SECONDS);
}

async function readReportText(response: Response) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REPORT_BYTES) {
    return null;
  }
  if (!response.body) return "";

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let bytesRead = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    bytesRead += value.byteLength;
    if (bytesRead > MAX_REPORT_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

function htmlDocument(body: string, reportData?: string, title?: string) {
  const pageTitle = title
    ? `${escapeHtml(title)} · Frameshift`
    : "Screenshot report · Frameshift";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Review screenshots before and after a code change.">
    <meta name="robots" content="noindex, nofollow, noarchive">
    <meta name="theme-color" content="#0c0f0f">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Frameshift">
    <meta property="og:title" content="${pageTitle}">
    <meta property="og:description" content="Review screenshots before and after a code change.">
    <meta property="og:image" content="https://frameshift.pub/frameshift-social.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Frameshift showing two screenshots split by a comparison line">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${pageTitle}">
    <meta name="twitter:description" content="Review screenshots before and after a code change.">
    <meta name="twitter:image" content="https://frameshift.pub/frameshift-social.png">
    <meta name="twitter:image:alt" content="Frameshift showing two screenshots split by a comparison line">
    <title>${pageTitle}</title>
    <link rel="stylesheet" href="/assets/main.css">
  </head>
  <body>
    <div id="root">${body}</div>
    ${reportData ? `<script id="frameshift-report-data" type="application/json">${reportData}</script>\n    <script type="module" src="/assets/client.js"></script>` : ""}
  </body>
</html>`;
}

function errorResponse(message: string, status: number, method: string) {
  const body = `<div class="app-shell"><section class="status-panel panel error-panel"><p class="kicker">Report error</p><h1>Could not load this report.</h1><p>${escapeHtml(message)}</p></section></div>`;
  return new Response(method === "HEAD" ? null : htmlDocument(body), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
    status,
  });
}

export async function serveReport(
  request: Request,
  options: ServerReportOptions = {},
) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      headers: { Allow: "GET, HEAD" },
      status: 405,
    });
  }

  const url = new URL(request.url);
  let source;
  try {
    source = parseScanSource(url.searchParams);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "The report URL is invalid.",
      400,
      request.method,
    );
  }
  if (source?.kind !== "github") {
    return errorResponse(
      "Choose a published GitHub report.",
      400,
      request.method,
    );
  }

  let response;
  try {
    response = await (options.fetchReport ?? fetch)(reportUrl(source), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return errorResponse(
      "The report could not be downloaded.",
      502,
      request.method,
    );
  }
  if (!response.ok) {
    return errorResponse(
      `The report request returned ${response.status}.`,
      response.status === 404 ? 404 : 502,
      request.method,
    );
  }
  let report;
  try {
    const text = await readReportText(response);
    if (text === null) {
      return errorResponse("The report is too large.", 502, request.method);
    }
    report = parseVisualDiffReport(JSON.parse(text));
  } catch {
    return errorResponse("The report is invalid.", 502, request.method);
  }

  const initialView = readReportView(url.searchParams);
  const markup = renderToString(
    <ReportPage
      initialSearch={url.search}
      initialView={initialView}
      report={report}
      source={source}
    />,
  );
  const maxAge = cacheSeconds(url.searchParams, options.now ?? Date.now());
  const title = report.metadata?.pullRequest?.title;
  const body = htmlDocument(markup, serializeReport(report), title);
  return new Response(request.method === "HEAD" ? null : body, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "text/html; charset=utf-8",
      "Vercel-CDN-Cache-Control": `public, max-age=${maxAge}, immutable`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
