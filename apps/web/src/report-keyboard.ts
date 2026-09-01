import type { VisualDiffStatus } from "@frameshift/report";

export type ReportQuickView = "after" | "before";
export type ScreenshotDirection = "down" | "up";

export type ReportArrowAction =
  | { kind: "quick-view"; view: ReportQuickView }
  | { direction: ScreenshotDirection; kind: "screenshot"; offset: -1 | 1 };

export function reportArrowAction(
  key: string,
  status: VisualDiffStatus,
): ReportArrowAction | null {
  if (key === "ArrowUp") {
    return { direction: "up", kind: "screenshot", offset: -1 };
  }
  if (key === "ArrowDown") {
    return { direction: "down", kind: "screenshot", offset: 1 };
  }
  if (status !== "changed") return null;
  if (key === "ArrowLeft") return { kind: "quick-view", view: "before" };
  if (key === "ArrowRight") return { kind: "quick-view", view: "after" };
  return null;
}

export function adjacentScreenshot(
  files: readonly string[],
  selectedFile: string,
  offset: -1 | 1,
): string | null {
  const index = files.indexOf(selectedFile);
  if (index === -1) return null;
  return files[index + offset] ?? null;
}
