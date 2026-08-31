const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const commitPattern = /^[a-f0-9]{40}$/i;

export type ScanSource = {
  ref: string;
  repo: string;
};

export function parseScanSource(params: URLSearchParams): ScanSource | null {
  const repo = params.get("repo");
  const ref = params.get("ref");
  if (repo === null && ref === null) return null;
  if (!repo || !repositoryPattern.test(repo)) {
    throw new Error("Repository must use the owner/name format.");
  }
  if (!ref || !commitPattern.test(ref)) {
    throw new Error("Report reference must be a full 40-character commit SHA.");
  }
  return { ref, repo };
}

export function reportBaseUrl(source: ScanSource): string {
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
