import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { artifactName, normalizeCommitSha } from "./artifact.mjs";

function validateRepository(repository) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? "")) {
    throw new Error("Enter the GitHub project as owner/name");
  }
  return repository;
}

function waitMilliseconds(value) {
  const seconds = Number(value ?? "180");
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 600) {
    throw new Error("wait-seconds must be a whole number from 0 through 600");
  }
  return seconds * 1_000;
}

export function pullRequestBaseSha({ event, githubSha, parents }) {
  const mergeSha = normalizeCommitSha(githubSha);
  const headSha = normalizeCommitSha(event?.pull_request?.head?.sha);
  if (parents.length !== 2) {
    throw new Error(
      `GitHub commit ${mergeSha} does not contain the expected pull request result`,
    );
  }
  const [baseSha, mergeHeadSha] = parents.map(normalizeCommitSha);
  if (mergeHeadSha !== headSha) {
    throw new Error(
      `GitHub commit ${mergeSha} was not created from pull request commit ${headSha}`,
    );
  }
  return baseSha;
}

async function githubJson(token, url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`GitHub API ${response.status}: ${details}`);
  }
  return response.json();
}

async function resolveSha(inputSha, token, repository) {
  if (inputSha) return normalizeCommitSha(inputSha);
  if (process.env.GITHUB_EVENT_NAME !== "pull_request") {
    throw new Error(
      "The sha input is required outside a pull request workflow",
    );
  }

  const event = JSON.parse(
    fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"),
  );
  const githubSha = normalizeCommitSha(process.env.GITHUB_SHA);
  const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const commit = await githubJson(
    token,
    `${apiUrl}/repos/${repository}/git/commits/${githubSha}`,
  );
  const parents = commit.parents?.map((parent) => parent.sha) ?? [];
  return pullRequestBaseSha({ event, githubSha, parents });
}

export function selectArtifact(artifacts, expectedName, sha) {
  return artifacts
    .filter(
      (artifact) =>
        artifact.name === expectedName &&
        artifact.expired === false &&
        artifact.workflow_run?.head_sha?.toLowerCase() === sha.toLowerCase(),
    )
    .toSorted((left, right) =>
      right.created_at.localeCompare(left.created_at),
    )[0];
}

async function listArtifacts(token, repository, name) {
  const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const url = new URL(`${apiUrl}/repos/${repository}/actions/artifacts`);
  url.search = new URLSearchParams({ name, per_page: "100" }).toString();
  return (await githubJson(token, url)).artifacts ?? [];
}

function setOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error("GitHub did not provide an output file");
  fs.appendFileSync(output, `${name}=${value}\n`);
}

async function main() {
  const token = process.env.BASELINE_TOKEN;
  if (!token) throw new Error("The github-token input is required");
  const repository = validateRepository(
    process.env.BASELINE_REPOSITORY || process.env.GITHUB_REPOSITORY,
  );
  const sha = await resolveSha(process.env.BASELINE_SHA, token, repository);
  const expectedName = artifactName(process.env.BASELINE_NAME, sha);
  const attempts =
    Math.floor(waitMilliseconds(process.env.BASELINE_WAIT_SECONDS) / 5_000) + 1;

  let artifact;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    artifact = selectArtifact(
      await listArtifacts(token, repository, expectedName),
      expectedName,
      sha,
    );
    if (artifact) break;
    if (attempt + 1 < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }

  if (!artifact) {
    throw new Error(
      `No saved screenshots named ${expectedName} were found. Run the screenshot workflow for ${sha}, then retry this job.`,
    );
  }

  setOutput("artifact", expectedName);
  setOutput("repository", repository);
  setOutput("run-id", String(artifact.workflow_run.id));
  setOutput("sha", sha);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
