const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const commitPattern = /^[a-f0-9]{40}$/i;
const fixturePattern = /^[a-z0-9-]+$/;

export type ScanSource =
  | { kind: "fixture"; name: string }
  | { kind: "github"; ref: string; repo: string };

export function parseScanSource(params: URLSearchParams): ScanSource | null {
  const repo = params.get("repo");
  const ref = params.get("ref");
  const fixture = params.get("fixture");
  if (repo === null && ref === null && fixture === null) return null;
  if (fixture !== null) {
    if (repo !== null || ref !== null) {
      throw new Error("Choose a fixture or a GitHub report, not both.");
    }
    if (!fixturePattern.test(fixture)) {
      throw new Error(
        "Fixture must use lowercase letters, numbers, or dashes.",
      );
    }
    return { kind: "fixture", name: fixture };
  }
  if (!repo || !repositoryPattern.test(repo)) {
    throw new Error("Repository must use the owner/name format.");
  }
  if (!ref || !commitPattern.test(ref)) {
    throw new Error("Report reference must be a full 40-character commit SHA.");
  }
  return { kind: "github", ref, repo };
}

function reportBaseUrl(source: ScanSource): string {
  if (source.kind === "fixture") {
    return `/${encodeURIComponent(source.name)}`;
  }
  const [owner, repository] = source.repo.split("/");
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${source.ref}`;
}

export function reportUrl(source: ScanSource): string {
  return `${reportBaseUrl(source)}/report.json`;
}

export function imageUrl(source: ScanSource, imagePath: string): string {
  return `${reportBaseUrl(source)}/${imagePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
