import fs from "node:fs";
import { pathToFileURL } from "node:url";

function sameRepository(left, right) {
  return left?.toLowerCase() === right?.toLowerCase();
}

export function classifyRun({ event, eventName, refName, repository }) {
  if (eventName === "pull_request") {
    const headRepository = event?.pull_request?.head?.repo?.full_name;
    if (!sameRepository(headRepository, repository)) {
      return {
        mode: "skip",
        reason: "pull requests from forks cannot read saved screenshots",
      };
    }
    return { mode: "report", reason: "pull request" };
  }

  if (
    (eventName === "push" || eventName === "workflow_dispatch") &&
    refName === event?.repository?.default_branch
  ) {
    return { mode: "save", reason: "default branch" };
  }

  return {
    mode: "skip",
    reason: `${eventName || "unknown"} runs are not used`,
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
  const result = classifyRun({
    event,
    eventName: process.env.GITHUB_EVENT_NAME,
    refName: process.env.GITHUB_REF_NAME,
    repository: process.env.GITHUB_REPOSITORY,
  });
  setOutput("mode", result.mode);
  console.log(`Frameshift chose ${result.mode}: ${result.reason}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
