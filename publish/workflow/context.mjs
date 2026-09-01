import fs from "node:fs";
import { pathToFileURL } from "node:url";

function fullSha(value) {
  return /^[0-9a-f]{40}$/i.test(value ?? "");
}

function positiveInteger(value) {
  return /^[1-9][0-9]*$/.test(String(value ?? ""));
}

export function publicationContext({ event, eventName, repository, runId }) {
  if (eventName === "pull_request") {
    const pullRequest = event?.pull_request?.number;
    const headSha = event?.pull_request?.head?.sha;
    if (
      event?.pull_request?.head?.repo?.full_name?.toLowerCase() !==
      repository.toLowerCase()
    ) {
      return { publish: false, reason: "pull request belongs to a fork" };
    }
    if (
      !positiveInteger(pullRequest) ||
      !positiveInteger(runId) ||
      !fullSha(headSha)
    ) {
      throw new Error(
        "The pull request must include its number, workflow run ID, and full Git commit ID",
      );
    }
    return {
      headSha: headSha.toLowerCase(),
      publish: true,
      pullRequest: String(pullRequest),
      reason: "pull request in this workflow",
      runId: String(runId),
    };
  }
  if (eventName !== "workflow_run") {
    return {
      publish: false,
      reason: `${eventName || "unknown"} events do not publish reports`,
    };
  }
  const run = event?.workflow_run;
  if (run?.conclusion !== "success") {
    return {
      publish: false,
      reason: "the screenshot workflow did not succeed",
    };
  }
  const pullRequest = run.pull_requests?.[0]?.number;
  if (!positiveInteger(pullRequest)) {
    return {
      publish: false,
      reason: "the screenshot workflow has no pull request",
    };
  }
  if (
    run.head_repository?.full_name?.toLowerCase() !== repository.toLowerCase()
  ) {
    return {
      publish: false,
      reason: "the screenshot workflow belongs to a fork",
    };
  }
  if (!positiveInteger(run.id) || !fullSha(run.head_sha)) {
    throw new Error(
      "The finished workflow must include its run ID and full Git commit ID",
    );
  }
  return {
    headSha: run.head_sha.toLowerCase(),
    publish: true,
    pullRequest: String(pullRequest),
    reason: "successful pull request from this project",
    runId: String(run.id),
  };
}

function setOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error("GitHub did not provide an output file");
  fs.appendFileSync(output, `${name}=${value}\n`);
}

function main() {
  const event = JSON.parse(
    fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"),
  );
  const result = publicationContext({
    event,
    eventName: process.env.GITHUB_EVENT_NAME,
    repository: process.env.GITHUB_REPOSITORY,
    runId: process.env.GITHUB_RUN_ID,
  });
  setOutput("publish", result.publish ? "true" : "false");
  if (result.publish) {
    setOutput("head-sha", result.headSha);
    setOutput("pull-request", result.pullRequest);
    setOutput("run-id", result.runId);
  }
  console.log(
    `Frameshift will ${result.publish ? "publish" : "skip this report"}: ${result.reason}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
