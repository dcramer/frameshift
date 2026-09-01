import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateScreenshots } from "./validate.mjs";

test("requires at least one PNG screenshot", (context) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "frameshift-screenshots-"),
  );
  context.after(() => fs.rmSync(root, { force: true, recursive: true }));
  fs.writeFileSync(path.join(root, "result.txt"), "not a screenshot");

  assert.throws(
    () => validateScreenshots(root),
    /No PNG screenshots were found/,
  );
  fs.mkdirSync(path.join(root, "nested"));
  fs.writeFileSync(path.join(root, "nested", "home.png"), "fixture");
  assert.equal(validateScreenshots(root), 1);
});
