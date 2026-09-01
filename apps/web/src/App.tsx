import {
  parseVisualDiffReport,
  type VisualDiffFile,
  type VisualDiffReport,
} from "@frameshift/report";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  imageUrl,
  parseScanSource,
  reportUrl,
  type ImageSource,
} from "./scan-source";

type LoadState =
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "loading" }
  | { kind: "ready"; report: VisualDiffReport; source: ImageSource };

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

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true" />;
}

function statusLabel(status: VisualDiffFile["status"]): string {
  if (status === "added") return "Added screenshot";
  if (status === "removed") return "Removed screenshot";
  if (status === "unchanged") return "Unchanged screenshot";
  return "Changed screenshot";
}

function SourceForm() {
  return (
    <section className="empty-state panel">
      <header className="home-brand">
        <BrandMark />
        <span>Frameshift</span>
      </header>
      <div className="home-copy">
        <p className="kicker">Screenshot review for GitHub</p>
        <h1>Your screenshots changed. Let’s find out why.</h1>
        <p>
          Frameshift puts the old, the new, and the suspiciously pink bits in
          one tidy report.
        </p>
      </div>
      <div className="source-actions">
        <a className="source-card source-card-primary" href="/?fixture=mixed">
          <span>
            <strong>Open the sample</strong>
            <em>Three changes. No scavenger hunt.</em>
          </span>
          <b aria-hidden="true">→</b>
        </a>
        <a
          className="source-card"
          href="https://github.com/dcramer/frameshift#use-the-github-action"
        >
          <span>
            <strong>Set up the GitHub Action</strong>
            <em>Bring your own screenshots.</em>
          </span>
          <b aria-hidden="true">↗</b>
        </a>
      </div>
      <footer className="home-note">
        Static, open source, and happy without a login.
      </footer>
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
          <small aria-hidden="true">Open</small>
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
        {previewFigure("Before", file.images.baseline)}
        {previewFigure("After", file.images.candidate)}
        {previewFigure("Difference", file.images.diff, "diff-figure")}
      </div>
    );
  }

  if (file.status === "unchanged") return null;

  const image =
    file.status === "added" ? file.images.candidate : file.images.baseline;
  return previewFigure(
    file.status === "added" ? "Added" : "Removed",
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
            <p className="kicker">Image preview</p>
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
        <footer>Esc closes this. Very advanced.</footer>
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
        <a className="report-brand" href="/">
          <BrandMark />
          <span>Frameshift</span>
        </a>
        <div className="scan-summary">
          <p>Report</p>
          <strong>
            <span>{changes.length}</span>{" "}
            {changes.length === 1 ? "change" : "changes"}
          </strong>
          <small>{sourceName}</small>
        </div>
        <fieldset className="summary-row" aria-label="Report summary">
          <span>
            <b>{report.summary.changed}</b> changed
          </span>
          <span>
            <b>{report.summary.added}</b> added
          </span>
          <span>
            <b>{report.summary.removed}</b> removed
          </span>
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
                <p className="kicker">{statusLabel(selected.status)}</p>
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
            <p className="kicker">Nothing to review</p>
            <h1>Not a pixel out of place.</h1>
            <p>Suspicious, but we’ll allow it.</p>
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
      } catch {
        if (active) {
          setState({ kind: "error" });
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className={
        state.kind === "ready" ? "app-shell report-shell" : "app-shell"
      }
    >
      {state.kind === "empty" && <SourceForm />}
      {state.kind === "loading" && (
        <section className="status-panel panel">
          <div className="loading-pulse" />
          <p>Fetching the screenshots…</p>
        </section>
      )}
      {state.kind === "error" && (
        <section className="status-panel panel error-panel">
          <p className="kicker">Well, that didn’t work</p>
          <h1>This report wouldn’t open.</h1>
          <p>
            Check the link and try again. The report may be missing, incomplete,
            or simply having a day.
          </p>
          <a href="/">Back to safety</a>
        </section>
      )}
      {state.kind === "ready" && (
        <ReportViewer report={state.report} source={state.source} />
      )}
    </div>
  );
}
