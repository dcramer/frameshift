import {
  parseVisualDiffReport,
  type VisualDiffFile,
  type VisualDiffReport,
} from "@frameshift/report";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  imageUrl,
  pageSource,
  reportUrl,
  type ImageSource,
} from "./scan-source";

type LoadState =
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "loading" }
  | { kind: "ready"; report: VisualDiffReport; source: ImageSource }
  | { kind: "setup" };

interface PreviewImage {
  alt: string;
  file: string;
  label: string;
  src: string;
}

const PROJECT_URL = "https://github.com/dcramer/frameshift";
const SAMPLE_PATH = "/sample/";
const SETUP_PATH = "/setup/";

function displayName(file: string): string {
  return file
    .replace(/\.png$/, "")
    .replace(/__/g, " · ")
    .replace(/-/g, " ");
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true" />;
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 2C6.477 2 2 6.59 2 12.253c0 4.53 2.865 8.373 6.839 9.73.5.094.682-.223.682-.493 0-.244-.009-1.052-.014-1.907-2.782.618-3.369-1.375-3.369-1.375-.455-1.184-1.11-1.499-1.11-1.499-.908-.636.069-.623.069-.623 1.004.073 1.532 1.057 1.532 1.057.892 1.568 2.341 1.115 2.91.853.091-.664.349-1.115.635-1.371-2.221-.259-4.555-1.139-4.555-5.066 0-1.119.39-2.034 1.029-2.751-.103-.26-.446-1.303.098-2.715 0 0 .84-.276 2.75 1.051A9.303 9.303 0 0 1 12 6.404a9.3 9.3 0 0 1 2.504.345c1.909-1.327 2.748-1.051 2.748-1.051.546 1.412.203 2.455.1 2.715.64.717 1.027 1.632 1.027 2.751 0 3.937-2.338 4.804-4.566 5.058.359.318.679.945.679 1.905 0 1.375-.012 2.484-.012 2.821 0 .273.18.592.688.492A10.02 10.02 0 0 0 22 12.253C22 6.59 17.523 2 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function statusLabel(status: VisualDiffFile["status"]): string {
  if (status === "added") return "Added screenshot";
  if (status === "removed") return "Removed screenshot";
  if (status === "unchanged") return "Unchanged screenshot";
  return "Changed screenshot";
}

function SourceForm() {
  return (
    <section className="empty-state">
      <header className="home-brand">
        <BrandMark />
        <span>Frameshift</span>
      </header>
      <div className="home-copy">
        <p className="kicker">Visual regression testing for GitHub</p>
        <h1>Review visual changes in one report.</h1>
        <p>
          Frameshift compares baseline and candidate screenshots, then publishes
          a static report for each pull request.
        </p>
      </div>
      <div className="source-actions">
        <a className="source-card source-card-primary" href={SAMPLE_PATH}>
          <span>
            <strong>View the sample report</strong>
            <em>See changed, added, and removed pages.</em>
          </span>
          <b aria-hidden="true">→</b>
        </a>
        <a className="source-card" href={SETUP_PATH}>
          <span>
            <strong>Set up Frameshift</strong>
            <em>Add comparison and publishing to your workflow.</em>
          </span>
          <b aria-hidden="true">↗</b>
        </a>
      </div>
      <footer className="home-note">
        <span>Static, open source, and no sign-in required.</span>
        <a aria-label="Frameshift on GitHub" href={PROJECT_URL}>
          <GitHubIcon />
        </a>
      </footer>
    </section>
  );
}

function SetupPage() {
  return (
    <main className="setup-page">
      <header className="setup-nav">
        <a className="setup-brand" href="/">
          <BrandMark />
          <span>Frameshift</span>
        </a>
        <a href={SAMPLE_PATH}>View the sample report →</a>
      </header>

      <article className="setup-document">
        <header className="setup-intro">
          <h1>Set up Frameshift</h1>
          <p>
            Capture matching baseline and candidate screenshots. Frameshift
            compares them and generates a static report.
          </p>
        </header>

        <section className="setup-section">
          <h2>Compare</h2>
          <p>
            Run this in your pull request workflow. Capture both versions on the
            same runner, and use matching paths for matching screenshots.
          </p>
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The code block scrolls on narrow screens. */}
          <pre tabIndex={0}>
            <code>{`permissions:
  contents: read

steps:
  - name: Compare screenshots
    id: visual-diff
    uses: dcramer/frameshift@<full-commit-sha>
    with:
      baseline: \${{ runner.temp }}/frameshift/baseline
      candidate: \${{ runner.temp }}/frameshift/candidate
      output: \${{ runner.temp }}/frameshift/report

  - uses: actions/upload-artifact@<full-commit-sha>
    with:
      name: frameshift-report
      path: \${{ runner.temp }}/frameshift/report`}</code>
          </pre>
        </section>

        <section className="setup-section">
          <h2>Publish</h2>
          <p>
            Run the publisher from a trusted workflow on your default branch. It
            adds the status, pull request comment, and review link.
          </p>
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The code block scrolls on narrow screens. */}
          <pre tabIndex={0}>
            <code>{`permissions:
  contents: write
  pull-requests: write
  statuses: write

steps:
  - uses: actions/download-artifact@<full-commit-sha>
    with:
      name: frameshift-report
      path: \${{ runner.temp }}/frameshift-report

  - uses: dcramer/frameshift/publish@<full-commit-sha>
    with:
      report: \${{ runner.temp }}/frameshift-report
      github-token: \${{ secrets.GITHUB_TOKEN }}
      head-sha: \${{ github.event.workflow_run.head_sha }}
      pull-request: \${{ github.event.workflow_run.pull_requests[0].number }}`}</code>
          </pre>
        </section>

        <aside className="setup-warning">
          <strong>Limit write permissions to the publisher.</strong>
          <p>
            Pin Actions to full commit SHAs. Never give write access to a job
            that runs pull request code.
          </p>
        </aside>

        <footer className="setup-footer">
          <a href={`${PROJECT_URL}#use-the-github-action`}>
            View the complete workflow on GitHub →
          </a>
        </footer>
      </article>
    </main>
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
        <footer>Press Esc to close.</footer>
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
  const sourceLink =
    source.kind === "github"
      ? {
          href: `https://github.com/${source.repo}/commit/${source.ref}`,
          label: source.repo,
          ref: source.ref.slice(0, 7),
        }
      : source.kind === "fixture"
        ? {
            href: PROJECT_URL,
            label: "dcramer/frameshift",
            ref: null,
          }
        : null;

  return (
    <main className="report-layout">
      <aside className="panel report-index">
        <a className="report-brand" href="/">
          <BrandMark />
          <span>Frameshift</span>
        </a>
        {sourceLink && (
          <div className="report-source">
            <a href={sourceLink.href}>
              <GitHubIcon />
              <span>{sourceLink.label}</span>
              {sourceLink.ref && <code>{sourceLink.ref}</code>}
            </a>
          </div>
        )}
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
            <p className="kicker">No visual changes</p>
            <h1>All screenshots match.</h1>
            <p>
              The report contains no changed, added, or removed screenshots.
            </p>
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
        if (window.location.pathname.replace(/\/+$/, "") === "/setup") {
          setState({ kind: "setup" });
          return;
        }
        const source = pageSource(
          window.location.pathname,
          new URLSearchParams(window.location.search),
        );
        if (!source) {
          setState({ kind: "empty" });
          return;
        }
        const response = await fetch(reportUrl(source));
        if (!response.ok)
          throw new Error(`Report request returned ${response.status}.`);
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
        state.kind === "ready"
          ? "app-shell report-shell"
          : state.kind === "setup"
            ? "app-shell setup-shell"
            : "app-shell"
      }
    >
      {state.kind === "empty" && <SourceForm />}
      {state.kind === "setup" && <SetupPage />}
      {state.kind === "loading" && (
        <section className="status-panel panel">
          <div className="loading-pulse" />
          <p>Loading report…</p>
        </section>
      )}
      {state.kind === "error" && (
        <section className="status-panel panel error-panel">
          <p className="kicker">Report unavailable</p>
          <h1>Could not load this report.</h1>
          <p>Verify the URL and confirm that the report files are available.</p>
          <a href="/">Return home</a>
        </section>
      )}
      {state.kind === "ready" && (
        <ReportViewer report={state.report} source={state.source} />
      )}
    </div>
  );
}
