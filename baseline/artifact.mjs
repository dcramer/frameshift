import fs from "node:fs";
import { pathToFileURL } from "node:url";

export function normalizeCommitSha(sha) {
  if (!/^[0-9a-f]{40}$/i.test(sha ?? "")) {
    throw new Error("sha must be a full 40-character Git commit ID");
  }
  return sha.toLowerCase();
}

export function artifactName(name, sha) {
  if (!/^[A-Za-z0-9_.-]+$/.test(name ?? "")) {
    throw new Error(
      "name may contain letters, numbers, dots, dashes, and underscores only",
    );
  }
  return `${name}-${normalizeCommitSha(sha)}`;
}

function setOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error("GitHub did not provide an output file");
  fs.appendFileSync(output, `${name}=${value}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    setOutput(
      "artifact",
      artifactName(process.env.BASELINE_NAME, process.env.BASELINE_SHA),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
