import assert from "node:assert/strict";
import test from "node:test";

import { publicationContext } from "./context.mjs";

const repository = "owner/project";
const headSha = "a".repeat(40);

test("publishes a report from the same pull-request workflow", () => {
  assert.deepEqual(
    publicationContext({
      event: {
        pull_request: {
          head: { repo: { full_name: repository }, sha: headSha },
          number: 42,
        },
      },
      eventName: "pull_request",
      repository,
      runId: "123",
    }),
    {
      headSha,
      publish: true,
      pullRequest: "42",
      reason: "pull request in this workflow",
      runId: "123",
    },
  );
});

test("skips a same-workflow fork pull request", () => {
  assert.equal(
    publicationContext({
      event: {
        pull_request: {
          head: {
            repo: { full_name: "contributor/project" },
            sha: headSha,
          },
          number: 42,
        },
      },
      eventName: "pull_request",
      repository,
      runId: "123",
    }).publish,
    false,
  );
});

function workflowRun(overrides = {}) {
  return {
    workflow_run: {
      conclusion: "success",
      head_repository: { full_name: repository },
      head_sha: headSha,
      id: 123,
      pull_requests: [{ number: 42 }],
      ...overrides,
    },
  };
}

test("publishes a successful same-repository pull request", () => {
  assert.deepEqual(
    publicationContext({
      event: workflowRun(),
      eventName: "workflow_run",
      repository,
      runId: "999",
    }),
    {
      headSha,
      publish: true,
      pullRequest: "42",
      reason: "successful pull request from this project",
      runId: "123",
    },
  );
});

test("skips failed source workflows", () => {
  assert.equal(
    publicationContext({
      event: workflowRun({ conclusion: "failure" }),
      eventName: "workflow_run",
      repository,
      runId: "999",
    }).publish,
    false,
  );
});

test("skips source workflows without a pull request", () => {
  assert.equal(
    publicationContext({
      event: workflowRun({ pull_requests: [] }),
      eventName: "workflow_run",
      repository,
      runId: "999",
    }).publish,
    false,
  );
});

test("skips fork source workflows", () => {
  assert.equal(
    publicationContext({
      event: workflowRun({
        head_repository: { full_name: "contributor/project" },
      }),
      eventName: "workflow_run",
      repository,
      runId: "999",
    }).publish,
    false,
  );
});
