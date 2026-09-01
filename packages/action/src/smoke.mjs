#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prepareActionQa, verifyActionQa } from "./qa.mjs";

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_DIR = path.resolve(SOURCE_DIR, "../../..");
const expectedSummary = {
  added: 1,
  changed: 1,
  removed: 1,
  unchanged: 0,
};

export async function runActionSmoke() {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "frameshift-smoke-"),
  );
  const fixtureRoot = path.join(tempRoot, "fixture");
  const githubOutput = path.join(tempRoot, "github-output.txt");
  try {
    const paths = await prepareActionQa(fixtureRoot);
    execFileSync(
      process.execPath,
      [path.join(REPOSITORY_DIR, "dist/index.mjs")],
      {
        cwd: tempRoot,
        env: {
          ...process.env,
          GITHUB_OUTPUT: githubOutput,
          INPUT_BASELINE: paths.baseline,
          INPUT_CANDIDATE: paths.candidate,
          INPUT_OUTPUT: paths.output,
        },
        stdio: "pipe",
      },
    );
    const output = await fs.readFile(githubOutput, "utf8");
    if (output !== "changes=3\n") {
      throw new Error(`Unexpected GitHub output: ${JSON.stringify(output)}`);
    }
    await verifyActionQa(fixtureRoot, "3");
    return { changes: 3, summary: expectedSummary };
  } finally {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runActionSmoke()
    .then(({ changes }) =>
      console.log(`built Action found changes in ${changes} screenshots`),
    )
    .catch((error) => {
      console.error(error instanceof Error ? error.stack : error);
      process.exitCode = 1;
    });
}
