export type ComparisonMode = "blend" | "difference" | "side-by-side" | "split";
export type ImageScale = "actual" | "fit";

export interface ReportView {
  file?: string;
  mode?: ComparisonMode;
  scale?: ImageScale;
}

const comparisonModes = new Set<ComparisonMode>([
  "blend",
  "difference",
  "side-by-side",
  "split",
]);
const imageScales = new Set<ImageScale>(["actual", "fit"]);

export function readReportView(params: URLSearchParams): ReportView {
  const file = params.get("file") || undefined;
  const mode = params.get("mode");
  const scale = params.get("scale");

  return {
    file,
    mode:
      mode && comparisonModes.has(mode as ComparisonMode)
        ? (mode as ComparisonMode)
        : undefined,
    scale:
      scale && imageScales.has(scale as ImageScale)
        ? (scale as ImageScale)
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
  params.set("scale", view.scale);
  return `?${params.toString()}`;
}
