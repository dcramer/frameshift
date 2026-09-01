import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { checkReportDirectory } from "@frameshift/report/directory";

export const COMMENT_MARKER = "<!-- frameshift-report -->";

function input(name, { required = false } = {}) {
  const value = process.env[`INPUT_${name.toUpperCase()}`]?.trim();
  if (required && !value) throw new Error(`Missing ${name} input`);
  return value;
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
}

function validateRepository(repository) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("repository must use owner/name form");
  }
  return repository;
}

function validateSha(sha) {
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error("head-sha must be a full commit SHA");
  }
  return sha.toLowerCase();
}

function validatePullRequest(value) {
  if (!value) return undefined;
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error("pull-request must be a positive integer");
  }
  return Number(value);
}

function changeCount(report) {
  return report.summary.added + report.summary.changed + report.summary.removed;
}

export function buildComment(report, viewerUrl) {
  const changes = changeCount(report);
  const headline = changes
    ? `**${changes} visual change${changes === 1 ? "" : "s"}** — ${report.summary.changed} changed · ${report.summary.added} added · ${report.summary.removed} removed`
    : "**No visual changes**";
  return [
    COMMENT_MARKER,
    "## Frameshift",
    "",
    headline,
    "",
    `[Review the visual report in Frameshift](${viewerUrl})`,
    "",
  ].join("\n");
}

export function buildViewerUrl(baseUrl, repository, reportRef) {
  const viewerUrl = new URL(baseUrl);
  viewerUrl.search = new URLSearchParams({
    ref: reportRef,
    repo: repository,
  }).toString();
  return viewerUrl.href;
}

async function githubRequest(token, endpoint, options = {}) {
  const response = await fetch(
    `${process.env.GITHUB_API_URL ?? "https://api.github.com"}/${endpoint}`,
    {
      ...options,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
        ...options.headers,
      },
    },
  );
  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`GitHub API ${response.status}: ${details}`);
  }
  if (response.status === 204) return undefined;
  return response.json();
}

async function updateStatus(token, repository, headSha, status) {
  await githubRequest(token, `repos/${repository}/statuses/${headSha}`, {
    body: JSON.stringify(status),
    method: "POST",
  });
}

async function upsertComment(token, repository, pullRequest, body) {
  let page = 1;
  let existing;
  while (!existing) {
    const comments = await githubRequest(
      token,
      `repos/${repository}/issues/${pullRequest}/comments?per_page=100&page=${page}`,
    );
    existing = comments.find((comment) =>
      comment.body?.includes(COMMENT_MARKER),
    );
    if (existing || comments.length < 100) break;
    page += 1;
  }

  await githubRequest(
    token,
    existing
      ? `repos/${repository}/issues/comments/${existing.id}`
      : `repos/${repository}/issues/${pullRequest}/comments`,
    {
      body: JSON.stringify({ body }),
      method: existing ? "PATCH" : "POST",
    },
  );
}

function publishReport(reportDirectory, repository, headSha, token) {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "frameshift-publish-"),
  );
  try {
    fs.cpSync(reportDirectory, tempDirectory, { recursive: true });
    git(["init", "-q"], { cwd: tempDirectory });
    git(["checkout", "--orphan", "frameshift-report"], {
      cwd: tempDirectory,
    });
    git(["add", "."], { cwd: tempDirectory });
    git(
      [
        "-c",
        "user.name=frameshift[bot]",
        "-c",
        "user.email=frameshift@users.noreply.github.com",
        "commit",
        "-m",
        `Publish Frameshift report for ${headSha}`,
      ],
      { cwd: tempDirectory },
    );
    const reportRef = git(["rev-parse", "HEAD"], {
      cwd: tempDirectory,
    }).trim();
    const runId = process.env.GITHUB_RUN_ID;
    const runAttempt = process.env.GITHUB_RUN_ATTEMPT;
    if (!/^[0-9]+$/.test(runId ?? "") || !/^[0-9]+$/.test(runAttempt ?? "")) {
      throw new Error("GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT must be integers");
    }
    const reportTag = `frameshift-report/${headSha}/${runId}-${runAttempt}`;
    git(["tag", reportTag], { cwd: tempDirectory });
    git(
      [
        "remote",
        "add",
        "origin",
        `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${repository}.git`,
      ],
      { cwd: tempDirectory },
    );
    const authorization = Buffer.from(`x-access-token:${token}`).toString(
      "base64",
    );
    const gitEnvironment = {
      ...process.env,
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${authorization}`,
    };
    git(["push", "origin", `refs/tags/${reportTag}`], {
      cwd: tempDirectory,
      env: gitEnvironment,
    });
    return reportRef;
  } finally {
    fs.rmSync(tempDirectory, { force: true, recursive: true });
  }
}

export async function main() {
  const reportDirectory = path.resolve(input("report", { required: true }));
  const token = input("github-token", { required: true });
  console.log(`::add-mask::${token}`);
  const repository = validateRepository(
    input("repository") || process.env.GITHUB_REPOSITORY || "",
  );
  const headSha = validateSha(input("head-sha", { required: true }));
  const pullRequest = validatePullRequest(input("pull-request"));
  const viewerBaseUrl = input("viewer-url") || "https://frameshift.pub/";
  const runUrl = `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;

  await updateStatus(token, repository, headSha, {
    context: "Frameshift",
    description: "Publishing visual report",
    state: "pending",
    target_url: runUrl,
  });

  try {
    const report = await checkReportDirectory(reportDirectory);
    const changes = changeCount(report);
    const reportRef = publishReport(
      reportDirectory,
      repository,
      headSha,
      token,
    );
    const viewerUrl = buildViewerUrl(viewerBaseUrl, repository, reportRef);
    if (pullRequest) {
      await upsertComment(
        token,
        repository,
        pullRequest,
        buildComment(report, viewerUrl),
      );
    }
    await updateStatus(token, repository, headSha, {
      context: "Frameshift",
      description: `${changes} visual change${changes === 1 ? "" : "s"}`,
      state: "success",
      target_url: viewerUrl,
    });
    setOutput("changes", changes);
    setOutput("report_ref", reportRef);
    setOutput("viewer_url", viewerUrl);
    console.log(`published ${changes} visual change(s) to ${viewerUrl}`);
  } catch (error) {
    await updateStatus(token, repository, headSha, {
      context: "Frameshift",
      description: "Could not publish visual report",
      state: "error",
      target_url: runUrl,
    }).catch(() => undefined);
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
