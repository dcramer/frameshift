import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function countPngs(directory) {
  let count = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      count += countPngs(absolute);
    } else if (entry.isFile() && entry.name.endsWith(".png")) {
      count += 1;
    }
  }
  return count;
}

export function validateSnapshots(value) {
  const snapshots = path.resolve(value || "");
  let stat;
  try {
    stat = fs.statSync(snapshots);
  } catch {
    throw new Error(`Snapshot directory does not exist: ${snapshots}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`Snapshot path is not a directory: ${snapshots}`);
  }
  const count = countPngs(snapshots);
  if (count === 0) {
    throw new Error(`No PNG screenshots found under ${snapshots}`);
  }
  return count;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const count = validateSnapshots(process.env.FRAMESHIFT_SNAPSHOTS);
    console.log(`Frameshift found ${count} PNG screenshot(s)`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
