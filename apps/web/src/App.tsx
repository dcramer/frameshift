import {
  parseVisualDiffReport,
  type VisualDiffFile,
  type VisualDiffReport,
} from "@frameshift/report";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  imageUrl,
  parseScanSource,
  reportUrl,
  type ScanSource,
} from "./scan-source";

type LoadState =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "loading" }
  | { kind: "ready"; report: VisualDiffReport; source: ScanSource };

function displayName(file: string): string {
  return file
    .replace(/\.png$/, "")
    .replace(/__/g, " · ")
    .replace(/-/g, " ");
}

function SourceForm() {
  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams({ ref: ref.trim(), repo: repo.trim() });
    window.location.assign(`/?${params.toString()}`);
  }

  return (
    <section className="empty-state panel">
      <div className="radar" aria-hidden="true">
        <span className="radar-contact contact-one" />
        <span className="radar-contact contact-two" />
      </div>
      <p className="eyebrow">Awaiting coordinates</p>
      <h1>Review a visual scan</h1>
      <p>
        Enter a public GitHub repository and the immutable commit that contains
        the report bundle.
      </p>
      <form onSubmit={submit}>
        <label>
          Repository
          <input
            name="repo"
            onChange={(event) => setRepo(event.target.value)}
            placeholder="owner/repository"
            required
            value={repo}
          />
        </label>
        <label>
          Report commit
          <input
            name="ref"
            onChange={(event) => setRef(event.target.value)}
            pattern="[a-fA-F0-9]{40}"
            placeholder="40-character commit SHA"
            required
            value={ref}
          />
        </label>
        <button type="submit">Begin scan</button>
      </form>
    </section>
  );
}

function ImagePanel({
  file,
  source,
}: {
  file: VisualDiffFile;
  source: ScanSource;
}) {
  if (file.status === "changed") {
    return (
      <div className="comparison-grid">
        <figure>
          <figcaption>Baseline</figcaption>
          <img
            alt={`${displayName(file.file)} baseline`}
            src={imageUrl(source, file.images.baseline)}
          />
        </figure>
        <figure>
          <figcaption>Candidate</figcaption>
          <img
            alt={`${displayName(file.file)} candidate`}
            src={imageUrl(source, file.images.candidate)}
          />
        </figure>
        <figure className="diff-figure">
          <figcaption>Pixel diff</figcaption>
          <img
            alt={`${displayName(file.file)} pixel diff`}
            src={imageUrl(source, file.images.diff)}
          />
        </figure>
      </div>
    );
  }

  if (file.status === "unchanged") return null;

  const image =
    file.status === "added" ? file.images.candidate : file.images.baseline;
  return (
    <figure className="single-figure">
      <figcaption>
        {file.status === "added" ? "Candidate" : "Baseline"}
      </figcaption>
      <img alt={displayName(file.file)} src={imageUrl(source, image)} />
    </figure>
  );
}

function ReportViewer({
  report,
  source,
}: {
  report: VisualDiffReport;
  source: ScanSource;
}) {
  const changes = useMemo(
    () => report.files.filter((file) => file.status !== "unchanged"),
    [report],
  );
  const [selectedFile, setSelectedFile] = useState(changes[0]?.file);
  const selected = changes.find((file) => file.file === selectedFile);

  return (
    <main className="report-layout">
      <aside className="panel report-index">
        <div className="scan-summary">
          <p className="eyebrow">Scan complete</p>
          <strong>{changes.length}</strong>
          <span>visual contacts</span>
        </div>
        <div className="summary-row" aria-label="Report summary">
          <span>{report.summary.changed} changed</span>
          <span>{report.summary.added} added</span>
          <span>{report.summary.removed} removed</span>
        </div>
        <nav aria-label="Changed screenshots">
          {changes.map((file) => (
            <button
              className={file.file === selectedFile ? "selected" : ""}
              key={file.file}
              onClick={() => setSelectedFile(file.file)}
              type="button"
            >
              <span>{displayName(file.file)}</span>
              <small data-status={file.status}>{file.status}</small>
            </button>
          ))}
        </nav>
      </aside>
      <section className="panel review-stage">
        {selected ? (
          <>
            <header>
              <div>
                <p className="eyebrow">Visual contact</p>
                <h1>{displayName(selected.file)}</h1>
              </div>
              <code>{selected.file}</code>
            </header>
            <ImagePanel file={selected} source={source} />
          </>
        ) : (
          <div className="no-changes">
            <p className="eyebrow">Sector clear</p>
            <h1>No visual changes detected</h1>
          </div>
        )}
      </section>
    </main>
  );
}

export function App() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const source = parseScanSource(
          new URLSearchParams(window.location.search),
        );
        if (!source) {
          setState({ kind: "empty" });
          return;
        }
        const response = await fetch(reportUrl(source));
        if (!response.ok)
          throw new Error(`GitHub returned ${response.status}.`);
        const report = parseVisualDiffReport(await response.json());
        if (active) setState({ kind: "ready", report, source });
      } catch (error) {
        if (active) {
          setState({
            kind: "error",
            message:
              error instanceof Error ? error.message : "Could not load report.",
          });
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="site-header">
        <a aria-label="Frameshift home" className="brand" href="/">
          <span className="brand-mark" aria-hidden="true" />
          <span>
            <strong>Frameshift</strong>
            <small>Visual reconnaissance</small>
          </span>
        </a>
        <span className="system-status">
          <i /> System online
        </span>
      </header>
      {state.kind === "empty" && <SourceForm />}
      {state.kind === "loading" && (
        <section className="status-panel panel">
          <div className="loading-pulse" />
          <p>Scanning report coordinates…</p>
        </section>
      )}
      {state.kind === "error" && (
        <section className="status-panel panel error-panel">
          <p className="eyebrow">Scan interrupted</p>
          <h1>Could not load this report</h1>
          <p>{state.message}</p>
          <a href="/">Enter new coordinates</a>
        </section>
      )}
      {state.kind === "ready" && (
        <ReportViewer report={state.report} source={state.source} />
      )}
    </div>
  );
}
