import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { artifactName } from "./artifact.mjs";

function validateRepository(repository) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? "")) {
    throw new Error("repository must use owner/name form");
  }
  return repository;
}

function waitMilliseconds(value) {
  const seconds = Number(value ?? "180");
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 600) {
    throw new Error("wait-seconds must be an integer from 0 through 600");
  }
  return seconds * 1_000;
}

export function selectArtifact(artifacts, expectedName, sha) {
  return artifacts
    .filter(
      (artifact) =>
        artifact.name === expectedName &&
        artifact.expired === false &&
        artifact.workflow_run?.head_sha?.toLowerCase() === sha.toLowerCase(),
    )
    .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
}

async function listArtifacts(token, repository, name) {
  const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const url = new URL(`${apiUrl}/repos/${repository}/actions/artifacts`);
  url.search = new URLSearchParams({ name, per_page: "100" }).toString();
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
  return (await response.json()).artifacts ?? [];
}

function setOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error("GITHUB_OUTPUT is required");
  fs.appendFileSync(output, `${name}=${value}\n`);
}

async function main() {
  const token = process.env.BASELINE_TOKEN;
  if (!token) throw new Error("github-token is required");
  const repository = validateRepository(
    process.env.BASELINE_REPOSITORY || process.env.GITHUB_REPOSITORY,
  );
  const sha = process.env.BASELINE_SHA?.toLowerCase();
  const expectedName = artifactName(process.env.BASELINE_NAME, sha);
  const deadline =
    Date.now() + waitMilliseconds(process.env.BASELINE_WAIT_SECONDS);

  let artifact;
  do {
    artifact = selectArtifact(
      await listArtifacts(token, repository, expectedName),
      expectedName,
      sha,
    );
    if (artifact || Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  } while (true);

  if (!artifact) {
    throw new Error(
      `No unexpired ${expectedName} artifact exists. Run the baseline workflow for ${sha}, then retry this job.`,
    );
  }

  setOutput("artifact", expectedName);
  setOutput("repository", repository);
  setOutput("run-id", String(artifact.workflow_run.id));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
