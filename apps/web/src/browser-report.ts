import {
  parseVisualDiffReport,
  type VisualDiffReport,
} from "@frameshift/report";

import type { ImageSource } from "./scan-source";

export interface BrowserReportFile {
  readonly name: string;
  readonly webkitRelativePath: string;
  text(): Promise<string>;
}

interface ObjectUrlFactory {
  create(file: BrowserReportFile): string;
  revoke(url: string): void;
}

export interface BrowserReport {
  dispose(): void;
  report: VisualDiffReport;
  source: ImageSource;
}

const browserObjectUrls: ObjectUrlFactory = {
  create(file) {
    return URL.createObjectURL(file as File);
  },
  revoke(url) {
    URL.revokeObjectURL(url);
  },
};

function selectedPath(file: BrowserReportFile): string {
  const path = file.webkitRelativePath || file.name;
  const segments = path.split("/");
  if (
    path.startsWith("/") ||
    path.includes("\\") ||
    segments.some((segment) => segment === "" || segment === "..")
  ) {
    throw new Error(
      `The selected folder contains a path Frameshift cannot use: ${path}`,
    );
  }
  return path;
}

function reportImagePaths(report: VisualDiffReport): string[] {
  const paths = new Set<string>();
  for (const file of report.files) {
    for (const path of Object.values(file.images)) paths.add(path);
  }
  return [...paths];
}

export async function readBrowserReport(
  selectedFiles: readonly BrowserReportFile[],
  objectUrls: ObjectUrlFactory = browserObjectUrls,
): Promise<BrowserReport> {
  if (selectedFiles.length === 0) {
    throw new Error("Choose a report folder.");
  }

  const files = new Map<string, BrowserReportFile>();
  for (const file of selectedFiles) {
    const path = selectedPath(file);
    if (files.has(path)) {
      throw new Error(
        `The selected folder contains the same file twice: ${path}`,
      );
    }
    files.set(path, file);
  }

  const reportPaths = [...files.keys()].filter(
    (path) => path === "report.json" || path.endsWith("/report.json"),
  );
  if (reportPaths.length !== 1) {
    throw new Error(
      reportPaths.length === 0
        ? "The selected folder does not contain report.json."
        : "Choose one report folder at a time.",
    );
  }

  const reportPath = reportPaths[0]!;
  const reportFile = files.get(reportPath)!;
  let value: unknown;
  try {
    value = JSON.parse(await reportFile.text());
  } catch {
    throw new Error("report.json is not valid JSON.");
  }

  let report: VisualDiffReport;
  try {
    report = parseVisualDiffReport(value);
  } catch {
    throw new Error("report.json is not a valid Frameshift 2 report.");
  }

  const root = reportPath.slice(0, -"report.json".length);
  const requiredImages = reportImagePaths(report);
  const missingImages = requiredImages.filter(
    (imagePath) => !files.has(`${root}${imagePath}`),
  );
  if (missingImages.length > 0) {
    throw new Error(
      `The selected folder is missing ${missingImages[0]}${
        missingImages.length > 1 ? ` and ${missingImages.length - 1} more` : ""
      }.`,
    );
  }

  const createdUrls: string[] = [];
  const imageUrls = new Map<string, string>();
  try {
    for (const imagePath of requiredImages) {
      const url = objectUrls.create(files.get(`${root}${imagePath}`)!);
      createdUrls.push(url);
      imageUrls.set(imagePath, url);
    }
  } catch (error) {
    for (const url of createdUrls) objectUrls.revoke(url);
    throw error;
  }

  return {
    dispose() {
      for (const url of createdUrls) objectUrls.revoke(url);
    },
    report,
    source: { imageUrls, kind: "browser" },
  };
}
