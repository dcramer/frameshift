const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const commitPattern = /^[a-f0-9]{40}$/i;
const fixturePattern = /^[a-z0-9-]+$/;

export type ScanSource =
  | { kind: "fixture"; name: string }
  | { kind: "github"; ref: string; repo: string }
  | { kind: "local" };

export type ImageSource =
  ScanSource | { imageUrls: ReadonlyMap<string, string>; kind: "browser" };

export function pageSource(
  pathname: string,
  params: URLSearchParams,
): ScanSource | null {
  if (pathname.replace(/\/+$/, "") === "/sample") {
    return { kind: "fixture", name: "mixed" };
  }
  return parseScanSource(params);
}

export function parseScanSource(params: URLSearchParams): ScanSource | null {
  const repo = params.get("repo");
  const ref = params.get("ref");
  const fixture = params.get("fixture");
  const local = params.get("local");
  if (repo === null && ref === null && fixture === null && local === null) {
    return null;
  }
  if (local !== null) {
    if (local !== "1" || repo !== null || ref !== null || fixture !== null) {
      throw new Error("The local report URL is invalid.");
    }
    return { kind: "local" };
  }
  if (fixture !== null) {
    if (repo !== null || ref !== null) {
      throw new Error("Choose a sample report or a GitHub report, not both.");
    }
    if (!fixturePattern.test(fixture)) {
      throw new Error(
        "Sample names may use lowercase letters, numbers, and dashes only.",
      );
    }
    return { kind: "fixture", name: fixture };
  }
  if (!repo || !repositoryPattern.test(repo)) {
    throw new Error("Enter the GitHub project as owner/name.");
  }
  if (!ref || !commitPattern.test(ref)) {
    throw new Error("Use the full 40-character Git commit ID for the report.");
  }
  return { kind: "github", ref, repo };
}

function reportBaseUrl(source: ScanSource): string {
  if (source.kind === "local") return "";
  if (source.kind === "fixture") {
    return `/${encodeURIComponent(source.name)}`;
  }
  const [owner, repository] = source.repo.split("/");
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${source.ref}`;
}

export function reportUrl(source: ScanSource): string {
  return `${reportBaseUrl(source)}/report.json`;
}

export function imageUrl(source: ImageSource, imagePath: string): string {
  if (source.kind === "browser") {
    const url = source.imageUrls.get(imagePath);
    if (!url) throw new Error(`The report is missing this image: ${imagePath}`);
    return url;
  }
  return `${reportBaseUrl(source)}/${imagePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
