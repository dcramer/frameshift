import fs from "node:fs";
import path from "node:path";

import { compareDirectories } from "./compare.mjs";

function pathInput(name) {
  const value = process.env[`INPUT_${name.toUpperCase()}`];
  if (!value) throw new Error(`The ${name} input is required`);
  return path.resolve(value);
}

function pullRequestMetadata() {
  const title = process.env.INPUT_PULL_REQUEST_TITLE;
  const number = process.env.INPUT_PULL_REQUEST_NUMBER;
  if (!title && !number) return undefined;
  if (!title) {
    throw new Error("The pull-request-title input is required with a number");
  }
  if (!number) return { pullRequest: { title } };
  const parsedNumber = Number(number);
  if (
    !/^\d+$/.test(number) ||
    !Number.isSafeInteger(parsedNumber) ||
    parsedNumber === 0
  ) {
    throw new Error("The pull-request-number input must be greater than zero");
  }
  return { pullRequest: { number: parsedNumber, title } };
}

function output(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

async function main() {
  const report = await compareDirectories({
    baseline: pathInput("baseline"),
    candidate: pathInput("candidate"),
    metadata: pullRequestMetadata(),
    output: pathInput("output"),
  });
  const changes =
    report.summary.added + report.summary.changed + report.summary.removed;
  output("changes", changes);
  console.log(`found changes in ${changes} screenshot(s)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
