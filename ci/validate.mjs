import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function countPngs(folder) {
  let count = 0;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const absolute = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      count += countPngs(absolute);
    } else if (entry.isFile() && entry.name.endsWith(".png")) {
      count += 1;
    }
  }
  return count;
}

export function validateScreenshots(value) {
  const screenshots = path.resolve(value || "");
  let stat;
  try {
    stat = fs.statSync(screenshots);
  } catch {
    throw new Error(`The screenshot folder does not exist: ${screenshots}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`The screenshot path is not a folder: ${screenshots}`);
  }
  const count = countPngs(screenshots);
  if (count === 0) {
    throw new Error(`No PNG screenshots were found in ${screenshots}`);
  }
  return count;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const count = validateScreenshots(process.env.FRAMESHIFT_SCREENSHOTS);
    console.log(`found ${count} PNG screenshot(s)`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
