import {
  parseVisualDiffReport,
  type VisualDiffFile,
  type VisualDiffReport,
} from "@frameshift/report";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { readBrowserReport } from "./browser-report";

import {
  imageUrl,
  parseScanSource,
  reportUrl,
  type ImageSource,
} from "./scan-source";

type LoadState =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "loading" }
  | { kind: "ready"; report: VisualDiffReport; source: ImageSource };

const directoryPickerAttributes = { webkitdirectory: "" };

interface PreviewImage {
  alt: string;
  file: string;
  label: string;
  src: string;
}

function displayName(file: string): string {
  return file
    .replace(/\.png$/, "")
    .replace(/__/g, " · ")
    .replace(/-/g, " ");
}

function SourceForm({
  onOpenReport,
}: {
  onOpenReport(files: readonly File[]): void;
}) {
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
        Inspect a Frameshift report without uploading it, or explore a complete
        example first.
      </p>
      <div className="source-actions">
        <label className="source-card source-card-primary">
          <span>
            <small>Your report</small>
            <strong>Open a report folder</strong>
            <em>Stays in this browser</em>
          </span>
          <b aria-hidden="true">↗</b>
          <input
            {...directoryPickerAttributes}
            aria-label="Open local report folder"
            multiple
            onChange={(event) => {
              const files = event.currentTarget.files;
              if (files?.length) onOpenReport(Array.from(files));
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
        <a className="source-card" href="/?fixture=mixed">
          <span>
            <small>Guided preview</small>
            <strong>View sample report</strong>
            <em>Changed, added, and removed</em>
          </span>
          <b aria-hidden="true">→</b>
        </a>
      </div>
      <div className="source-divider" aria-hidden="true">
        <span>Load an immutable GitHub report</span>
      </div>
      <form className="github-source" onSubmit={submit}>
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
  onPreview,
  source,
}: {
  file: VisualDiffFile;
  onPreview(image: PreviewImage): void;
  source: ImageSource;
}) {
  function previewFigure(label: string, path: string, className?: string) {
    const alt = `${displayName(file.file)} ${label.toLowerCase()}`;
    const preview = {
      alt,
      file: file.file,
      label,
      src: imageUrl(source, path),
    };
    return (
      <figure className={className}>
        <figcaption>
          <span>{label}</span>
          <small aria-hidden="true">Expand</small>
        </figcaption>
        <button
          aria-label={`Open ${label.toLowerCase()} image full screen`}
          className="image-trigger"
          onClick={() => onPreview(preview)}
          type="button"
        >
          <img alt={alt} src={preview.src} />
        </button>
      </figure>
    );
  }

  if (file.status === "changed") {
    return (
      <div className="comparison-grid">
        {previewFigure("Baseline", file.images.baseline)}
        {previewFigure("Candidate", file.images.candidate)}
        {previewFigure("Pixel diff", file.images.diff, "diff-figure")}
      </div>
    );
  }

  if (file.status === "unchanged") return null;

  const image =
    file.status === "added" ? file.images.candidate : file.images.baseline;
  return previewFigure(
    file.status === "added" ? "Candidate" : "Baseline",
    image,
    "single-figure",
  );
}

function ImageLightbox({
  image,
  onClose,
}: {
  image: PreviewImage;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog
      aria-labelledby="image-lightbox-title"
      className="image-lightbox"
      onClose={onClose}
      ref={dialog}
    >
      <div className="lightbox-frame">
        <header>
          <div>
            <p className="eyebrow">Fullscreen preview</p>
            <h2 id="image-lightbox-title">{image.label}</h2>
            <code>{image.file}</code>
          </div>
          <button
            aria-label="Close full-screen image"
            onClick={() => dialog.current?.close()}
            type="button"
          >
            ×
          </button>
        </header>
        <div className="lightbox-canvas">
          <img alt={image.alt} src={image.src} />
        </div>
        <footer>Press Esc to return to the report</footer>
      </div>
    </dialog>
  );
}

function ReportViewer({
  report,
  source,
}: {
  report: VisualDiffReport;
  source: ImageSource;
}) {
  const changes = useMemo(
    () => report.files.filter((file) => file.status !== "unchanged"),
    [report],
  );
  const [selectedFile, setSelectedFile] = useState(
    changes.find((file) => file.status === "changed")?.file ?? changes[0]?.file,
  );
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const selected = changes.find((file) => file.file === selectedFile);
  const sourceName =
    source.kind === "fixture"
      ? "Sample report"
      : source.kind === "browser"
        ? "Local folder"
        : source.kind === "github"
          ? "GitHub report"
          : "Local report";

  return (
    <main className="report-layout">
      <aside className="panel report-index">
        <div className="scan-summary">
          <p className="eyebrow">Scan complete</p>
          <strong>{changes.length}</strong>
          <span>visual contacts</span>
          <small className="report-origin">{sourceName}</small>
        </div>
        <fieldset className="summary-row" aria-label="Report summary">
          <span>{report.summary.changed} changed</span>
          <span>{report.summary.added} added</span>
          <span>{report.summary.removed} removed</span>
        </fieldset>
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
            <ImagePanel
              file={selected}
              onPreview={setPreviewImage}
              source={source}
            />
          </>
        ) : (
          <div className="no-changes">
            <p className="eyebrow">Sector clear</p>
            <h1>No visual changes detected</h1>
          </div>
        )}
      </section>
      {previewImage && (
        <ImageLightbox
          image={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </main>
  );
}

export function App() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const disposeBrowserReport = useRef<(() => void) | null>(null);

  async function openBrowserReport(files: readonly File[]) {
    setState({ kind: "loading" });
    try {
      const browserReport = await readBrowserReport(files);
      disposeBrowserReport.current?.();
      disposeBrowserReport.current = browserReport.dispose;
      setState({
        kind: "ready",
        report: browserReport.report,
        source: browserReport.source,
      });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Could not open report.",
      });
    }
  }

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
      disposeBrowserReport.current?.();
    };
  }, []);

  return (
    <div className="app-shell">
      {state.kind === "empty" && (
        <SourceForm onOpenReport={(files) => void openBrowserReport(files)} />
      )}
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
