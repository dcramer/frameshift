import fs from "node:fs/promises";

import { screenshotDirectory } from "./support";

export default async function globalSetup() {
  await fs.rm(screenshotDirectory, { force: true, recursive: true });
  await fs.mkdir(screenshotDirectory, { recursive: true });
}
