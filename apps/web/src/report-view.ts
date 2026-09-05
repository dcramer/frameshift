export type ComparisonMode = "blend" | "difference" | "side-by-side" | "split";

export interface ReportView {
  file?: string;
  mode?: ComparisonMode;
}

const comparisonModes = new Set<ComparisonMode>([
  "blend",
  "difference",
  "side-by-side",
  "split",
]);
export function readReportView(params: URLSearchParams): ReportView {
  const file = params.get("file") || undefined;
  const mode = params.get("mode");

  return {
    file,
    mode:
      mode && comparisonModes.has(mode as ComparisonMode)
        ? (mode as ComparisonMode)
        : undefined,
  };
}

export function writeReportView(
  search: string,
  view: Required<ReportView>,
): string {
  const params = new URLSearchParams(search);
  params.set("file", view.file);
  params.set("mode", view.mode);
  params.delete("scale");
  return `?${params.toString()}`;
}
