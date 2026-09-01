import assert from "node:assert/strict";
import test from "node:test";

import { classifyRun } from "./context.mjs";

const repository = "owner/project";

test("records the default branch as a baseline", () => {
  assert.deepEqual(
    classifyRun({
      event: { repository: { default_branch: "trunk" } },
      eventName: "push",
      refName: "trunk",
      repository,
    }),
    { mode: "baseline", reason: "default branch" },
  );
});

test("creates a report for a same-repository pull request", () => {
  assert.deepEqual(
    classifyRun({
      event: {
        pull_request: { head: { repo: { full_name: "OWNER/PROJECT" } } },
      },
      eventName: "pull_request",
      refName: "feature",
      repository,
    }),
    { mode: "report", reason: "pull request" },
  );
});

test("skips fork pull requests", () => {
  assert.deepEqual(
    classifyRun({
      event: {
        pull_request: { head: { repo: { full_name: "contributor/project" } } },
      },
      eventName: "pull_request",
      refName: "feature",
      repository,
    }),
    {
      mode: "skip",
      reason: "fork pull requests cannot read baseline artifacts",
    },
  );
});

test("skips non-default pushes", () => {
  assert.equal(
    classifyRun({
      event: { repository: { default_branch: "main" } },
      eventName: "push",
      refName: "feature",
      repository,
    }).mode,
    "skip",
  );
});
