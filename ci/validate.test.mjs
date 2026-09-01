import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateSnapshots } from "./validate.mjs";

test("requires at least one PNG screenshot", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "frameshift-snapshots-"));
  context.after(() => fs.rmSync(root, { force: true, recursive: true }));
  fs.writeFileSync(path.join(root, "result.txt"), "not a screenshot");

  assert.throws(() => validateSnapshots(root), /No PNG screenshots found/);
  fs.mkdirSync(path.join(root, "nested"));
  fs.writeFileSync(path.join(root, "nested", "home.png"), "fixture");
  assert.equal(validateSnapshots(root), 1);
});
