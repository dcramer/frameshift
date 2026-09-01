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
        reason: "fork pull requests cannot read baseline artifacts",
      };
    }
    return { mode: "report", reason: "pull request" };
  }

  if (
    (eventName === "push" || eventName === "workflow_dispatch") &&
    refName === event?.repository?.default_branch
  ) {
    return { mode: "baseline", reason: "default branch" };
  }

  return { mode: "skip", reason: `unsupported ${eventName || "unknown"} run` };
}

function setOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error("GITHUB_OUTPUT is required");
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
  console.log(`Frameshift ${result.mode}: ${result.reason}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
