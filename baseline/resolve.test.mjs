import assert from "node:assert/strict";
import test from "node:test";

import { artifactName } from "./artifact.mjs";
import { pullRequestBaseSha, selectArtifact } from "./resolve.mjs";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const HEAD_SHA = "89abcdef0123456789abcdef0123456789abcdef";
const MERGE_SHA = "fedcba9876543210fedcba9876543210fedcba98";

test("builds an immutable artifact name", () => {
  assert.equal(artifactName("web-screenshots", SHA), `web-screenshots-${SHA}`);
  assert.throws(() => artifactName("web screenshots", SHA), /name must/);
  assert.throws(() => artifactName("web-screenshots", "main"), /full commit/);
});

test("selects the newest unexpired artifact for the exact source SHA", () => {
  const expectedName = artifactName("web-screenshots", SHA);
  const selected = selectArtifact(
    [
      {
        created_at: "2026-01-01T00:00:00Z",
        expired: false,
        name: expectedName,
        workflow_run: { head_sha: SHA, id: 1 },
      },
      {
        created_at: "2026-01-02T00:00:00Z",
        expired: true,
        name: expectedName,
        workflow_run: { head_sha: SHA, id: 2 },
      },
      {
        created_at: "2026-01-03T00:00:00Z",
        expired: false,
        name: expectedName,
        workflow_run: {
          head_sha: "ffffffffffffffffffffffffffffffffffffffff",
          id: 3,
        },
      },
      {
        created_at: "2026-01-04T00:00:00Z",
        expired: false,
        name: expectedName,
        workflow_run: { head_sha: SHA, id: 4 },
      },
    ],
    expectedName,
    SHA,
  );

  assert.equal(selected.workflow_run.id, 4);
});

test("derives the exact base from the checked-out pull request merge", () => {
  assert.equal(
    pullRequestBaseSha({
      event: { pull_request: { head: { sha: HEAD_SHA } } },
      githubSha: MERGE_SHA,
      parents: [SHA, HEAD_SHA],
    }),
    SHA,
  );
});

test("rejects a merge commit for a different pull request head", () => {
  assert.throws(
    () =>
      pullRequestBaseSha({
        event: { pull_request: { head: { sha: HEAD_SHA } } },
        githubSha: MERGE_SHA,
        parents: [SHA, "ffffffffffffffffffffffffffffffffffffffff"],
      }),
    /does not merge the pull request head/,
  );
});
