import { type VisualDiffFile, type VisualDiffReport } from "@frameshift/report";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import yaml from "highlight.js/lib/languages/yaml";
import { useEffect, useMemo, useRef, useState } from "react";

import { loadReport } from "./load-report";
import { imageUrl, pageSource, type ImageSource } from "./scan-source";
import {
  compareScreenshotNames,
  displayName,
  screenshotBranches,
} from "./screenshot-name";

type LoadState =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "loading" }
  | { kind: "ready"; report: VisualDiffReport; source: ImageSource }
  | { kind: "setup" };

interface PreviewImage {
  alt: string;
  file: string;
  label: string;
  src: string;
}

type ComparisonMode = "blend" | "difference" | "side-by-side" | "split";
type ImageScale = "actual" | "fit";

const COMPARISON_MODES: { label: string; value: ComparisonMode }[] = [
  { label: "Highlights", value: "difference" },
  { label: "Slider", value: "split" },
  { label: "Side by side", value: "side-by-side" },
  { label: "Fade", value: "blend" },
];

const COMPARISON_MODE_STORAGE_KEY = "frameshift:comparison-mode";

const PROJECT_URL = "https://github.com/dcramer/frameshift";
const SAMPLE_PATH = "/sample/";
const GUIDE_PATH = "/guide/";
const ACTION_REF = "68a8b5e8bbd439088ef9a044e693c5de9efe7ecd";
const PLAYWRIGHT_EXAMPLE = `import { test } from "@playwright/test";

test("account settings", async ({ page }) => {
  await page.goto("/settings");
  await page.screenshot({
    path: "test-output/screenshots/settings.png",
    fullPage: true,
  });
});`;
const SETUP_WORKFLOW = `name: Screenshot checks

on:
  push:
  pull_request:
  workflow_dispatch:

permissions:
  actions: read
  contents: read

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      # Keep your existing setup steps here.
      - name: Run screenshot tests
        run: pnpm exec playwright test
      - name: Record screenshot results
        uses: dcramer/frameshift/ci@${ACTION_REF}
        with:
          screenshots: test-output/screenshots

  frameshift:
    needs: e2e
    if: >-
      github.event_name == 'pull_request' &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: write
      pull-requests: write
      statuses: write
    steps:
      # This job never checks out or runs pull request code.
      - uses: dcramer/frameshift/publish/workflow@${ACTION_REF}`;
const ADVANCED_STORAGE_EXAMPLE = `- name: Save screenshots
  uses: dcramer/frameshift/baseline/upload@${ACTION_REF}
  with:
    path: test-output/screenshots
    name: chromium

- name: Download saved screenshots
  uses: dcramer/frameshift/baseline@${ACTION_REF}
  id: saved-screenshots
  with:
    path: test-output/before
    name: chromium`;

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("yaml", yaml);

function CodeBlock({
  code,
  language,
}: {
  code: string;
  language: "typescript" | "yaml";
}) {
  const highlighted = hljs.highlight(code, { language }).value;
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll wide code blocks.
    <pre tabIndex={0}>
      {/* Highlight.js escapes the module-owned snippets before it adds spans. */}
      <code
        className={`hljs language-${language}`}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </pre>
  );
}

function initialComparisonMode(): ComparisonMode {
  if (typeof window === "undefined") return "difference";
  try {
    const savedMode = window.localStorage.getItem(COMPARISON_MODE_STORAGE_KEY);
    if (COMPARISON_MODES.some((item) => item.value === savedMode)) {
      return savedMode as ComparisonMode;
    }
  } catch {
    // Some browsers block saved settings.
  }
  return "difference";
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true" />;
}

function ComparisonModeIcon({ mode }: { mode: ComparisonMode }) {
  return (
    <svg
      aria-hidden="true"
      className="mode-icon"
      fill="none"
      focusable="false"
      viewBox="0 0 24 18"
    >
      {mode === "difference" ? (
        <>
          <rect height="16" width="22" x="1" y="1" />
          <path d="M5 4h4v4H5zM15 4h4v4h-4zM5 11h4v3H5z" fill="currentColor" />
          <path d="M15 11h4v3h-4z" />
        </>
      ) : mode === "split" ? (
        <>
          <rect height="16" width="22" x="1" y="1" />
          <path d="M12 1v16M9 6 6 9l3 3M15 6l3 3-3 3" />
        </>
      ) : mode === "side-by-side" ? (
        <>
          <rect height="16" width="9" x="1" y="1" />
          <rect height="16" width="9" x="14" y="1" />
        </>
      ) : (
        <>
          <rect height="12" width="15" x="1" y="1" />
          <rect height="12" width="15" x="8" y="5" />
          <path d="M8 5h8v8H8z" fill="currentColor" opacity="0.35" />
        </>
      )}
    </svg>
  );
}

function ImageScaleIcon({ scale }: { scale: ImageScale }) {
  return (
    <svg
      aria-hidden="true"
      className="mode-icon"
      fill="none"
      focusable="false"
      viewBox="0 0 24 18"
    >
      {scale === "fit" ? (
        <>
          <rect height="16" width="22" x="1" y="1" />
          <rect height="8" width="12" x="6" y="5" />
        </>
      ) : (
        <>
          <path d="M8 1H1v7M16 1h7v7M23 10v7h-7M8 17H1v-7" />
          <rect fill="currentColor" height="4" width="4" x="10" y="7" />
        </>
      )}
    </svg>
  );
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

function SourceForm() {
  return (
    <section className="empty-state">
      <header className="home-brand">
        <BrandMark />
        <span>Frameshift</span>
      </header>
      <div className="home-copy">
        <p className="kicker">Screenshot checks for GitHub</p>
        <h1>Review every screenshot in one place.</h1>
        <p>
          Frameshift compares screenshots from before and after a code change,
          then posts a review link on the pull request.
        </p>
      </div>
      <div className="source-actions">
        <a className="source-card source-card-primary" href={SAMPLE_PATH}>
          <span>
            <strong>View the sample report</strong>
            <em>See changed, new, removed, and matching pages.</em>
          </span>
          <b aria-hidden="true">→</b>
        </a>
        <a className="source-card" href={GUIDE_PATH}>
          <span>
            <strong>Set up Frameshift</strong>
            <em>Add screenshot checks to GitHub Actions.</em>
          </span>
          <b aria-hidden="true">↗</b>
        </a>
      </div>
      <footer className="home-note">
        <span>Open source. No server or sign-in required.</span>
        <a aria-label="Frameshift on GitHub" href={PROJECT_URL}>
          <GitHubIcon />
        </a>
      </footer>
    </section>
  );
}

function GuidePage() {
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
            Point your existing screenshot tests at one folder. Frameshift uses
            those PNG files to add a review link to each pull request.
          </p>
        </header>

        <section className="setup-section">
          <p className="setup-step">Step 1</p>
          <h2>Save screenshots to one folder</h2>
          <p>
            Keep the screenshot calls you already have. Frameshift only needs
            stable file names and one complete folder after the tests finish.
            Here is the whole idea in Playwright:
          </p>
          <CodeBlock code={PLAYWRIGHT_EXAMPLE} language="typescript" />
          <p>
            File names become labels. Use <code>__</code> for variants:
            <code> account__desktop.png</code> and
            <code> account__mobile.png</code> appear together under Account.
          </p>
        </section>

        <section className="setup-section">
          <p className="setup-step">Step 2</p>
          <h2>Add Frameshift after the tests</h2>
          <p>
            Replace the test command and folder below. The second job lets
            Frameshift add the GitHub check and comment. It does not download or
            run pull request code, and it does not rerun your tests.
          </p>
          <CodeBlock code={SETUP_WORKFLOW} language="yaml" />
        </section>

        <aside className="setup-warning">
          <strong>Merge this workflow before testing a pull request.</strong>
          <p>
            Let it finish on the default branch once. That run saves the
            screenshots for that exact commit. Frameshift stops if they are
            missing. It never guesses which screenshots to use.
          </p>
        </aside>

        <section className="setup-section setup-behavior">
          <h2>Good to know</h2>
          <ul className="setup-checklist">
            <li>Your project must be public on GitHub.</li>
            <li>
              Run this workflow for pull requests and after every push to your
              default branch.
            </li>
            <li>
              Give Frameshift one complete screenshot folder. A missing file
              counts as removed. Combine split test results before this step.
            </li>
            <li>
              GitHub keeps the screenshots and reports for 30 days. Frameshift
              removes old reports when it saves a new one.
            </li>
            <li>
              When every screenshot matches, Frameshift adds a passing check but
              does not comment. Set <code>comment-on-no-changes: true</code> on
              the last step to comment anyway.
            </li>
            <li>
              Frameshift skips pull requests from forks because they cannot
              safely read the saved screenshots or write results to the project.
            </li>
          </ul>
        </section>

        <section className="setup-section" id="configuration">
          <h2>Configuration</h2>
          <p>
            Keep the defaults unless your project needs one of these changes.
          </p>
          <h3>Common options</h3>
          <ul className="setup-checklist">
            <li>
              Use more than one screenshot set: add a unique{" "}
              <code>saved-name</code>
              to each screenshot recording step.
            </li>
            <li>
              Keep saved screenshots longer: set
              <code> screenshot-retention-days</code>. The default is 30 days.
            </li>
            <li>
              Keep the temporary pull request report longer: set
              <code> report-retention-days</code>. The default is 7 days.
            </li>
            <li>
              Keep the published report longer: set <code>retention-days</code>
              on the publishing step. The default is 30 days.
            </li>
            <li>
              Comment when every screenshot matches: set
              <code> comment-on-no-changes: true</code> on the publishing step.
            </li>
            <li>
              Use another viewer: set <code>viewer-url</code> on the publishing
              step.
            </li>
          </ul>

          <details className="setup-details">
            <summary>Every Action option</summary>
            <h3>Screenshot step</h3>
            <ul className="setup-checklist">
              <li>
                <code>screenshots</code>: the complete folder of PNG files.
                Required.
              </li>
              <li>
                <code>saved-name</code>: a stable name for this screenshot set.
              </li>
              <li>
                <code>screenshot-retention-days</code>: days to keep screenshots
                from the default branch.
              </li>
              <li>
                <code>report-retention-days</code>: days to keep the temporary
                pull request report.
              </li>
              <li>
                <code>github-token</code>: a token that can read saved
                screenshots. The workflow token is the default.
              </li>
            </ul>
            <h3>Publishing step</h3>
            <ul className="setup-checklist">
              <li>
                <code>comment-on-no-changes</code>: add a comment when all files
                match.
              </li>
              <li>
                <code>retention-days</code>: days to keep the published report.
              </li>
              <li>
                <code>viewer-url</code>: the Frameshift viewer address.
              </li>
              <li>
                <code>artifact-name</code>: the name of the temporary report.
              </li>
              <li>
                <code>run-id</code>, <code>repository</code>,
                <code> head-sha</code>, and <code>pull-request</code>: identify
                a report made by another workflow run.
              </li>
              <li>
                <code>github-token</code>: a token that can read and publish the
                report. The workflow token is the default.
              </li>
            </ul>
          </details>

          <h3 id="advanced-storage">Advanced storage</h3>
          <p>
            The <code>ci</code> Action already saves and finds screenshots. Use
            the lower-level Actions only when your workflow must separate those
            operations.
          </p>
          <CodeBlock code={ADVANCED_STORAGE_EXAMPLE} language="yaml" />
          <ul className="setup-checklist">
            <li>
              Use the same <code>name</code> in both steps.
            </li>
            <li>
              Save uses the current commit unless you set <code>sha</code>. It
              also accepts <code>retention-days</code>.
            </li>
            <li>
              Download finds the exact default-branch commit tested by the pull
              request. It never chooses screenshots from another commit.
            </li>
            <li>
              Download also accepts <code>sha</code>, <code>repository</code>,
              <code> github-token</code>, and <code>wait-seconds</code>. It
              waits up to 180 seconds by default, then stops if the screenshots
              are missing or expired.
            </li>
            <li>
              The selected commit is available as
              <code> steps.saved-screenshots.outputs.sha</code>.
            </li>
          </ul>
        </section>

        <footer className="setup-footer">
          <a href={PROJECT_URL}>Read the project README →</a>
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
  const [mode, setMode] = useState<ComparisonMode>(initialComparisonMode);
  const [scale, setScale] = useState<ImageScale>("fit");
  const [split, setSplit] = useState(50);
  const [blend, setBlend] = useState(50);

  function selectMode(nextMode: ComparisonMode) {
    setMode(nextMode);
    try {
      window.localStorage.setItem(COMPARISON_MODE_STORAGE_KEY, nextMode);
    } catch {
      // The selected mode still works for this page when storage is blocked.
    }
  }

  function previewImage(label: string, path: string): PreviewImage {
    const alt = `${displayName(file.file)} ${label.toLowerCase()}`;
    return {
      alt,
      file: file.file,
      label,
      src: imageUrl(source, path),
    };
  }

  function previewButton(label: string, path: string, className?: string) {
    const preview = previewImage(label, path);
    return (
      <button
        aria-label={`Open ${label.toLowerCase()} image full screen`}
        className={`image-trigger ${className ?? ""}`.trim()}
        onClick={() => onPreview(preview)}
        type="button"
      >
        <img alt={preview.alt} src={preview.src} />
      </button>
    );
  }

  if (file.status === "changed") {
    const before = previewImage("Before", file.images.baseline);
    const after = previewImage("After", file.images.candidate);
    const difference = previewImage("Highlights", file.images.diff);

    return (
      <section className="comparison-viewer" data-scale={scale}>
        <header className="comparison-toolbar">
          <fieldset className="scale-switch" aria-label="Image size">
            <button
              aria-label="Fit image"
              aria-pressed={scale === "fit"}
              data-label="Fit image"
              onClick={() => setScale("fit")}
              title="Fit image"
              type="button"
            >
              <ImageScaleIcon scale="fit" />
              <span>Fit</span>
            </button>
            <button
              aria-label="Full-size image"
              aria-pressed={scale === "actual"}
              data-label="Full size"
              onClick={() => setScale("actual")}
              title="Full size"
              type="button"
            >
              <ImageScaleIcon scale="actual" />
              <span>Full size</span>
            </button>
          </fieldset>
          <fieldset className="mode-switch" aria-label="View">
            {COMPARISON_MODES.map((item) => (
              <button
                aria-label={item.label}
                aria-pressed={mode === item.value}
                data-label={item.label}
                key={item.value}
                onClick={() => selectMode(item.value)}
                title={item.label}
                type="button"
              >
                <ComparisonModeIcon mode={item.value} />
                <span>{item.label}</span>
              </button>
            ))}
          </fieldset>
        </header>

        {mode === "side-by-side" ? (
          <div className="comparison-scroll" key={mode}>
            <div className="comparison-pair">
              <div className="comparison-pane">
                <span className="comparison-caption">
                  <i
                    aria-hidden="true"
                    className="legend-swatch legend-before"
                  />
                  Before
                </span>
                <button
                  aria-label="Open before image full screen"
                  className="image-trigger"
                  onClick={() => onPreview(before)}
                  type="button"
                >
                  <img alt={before.alt} src={before.src} />
                </button>
              </div>
              <div className="comparison-pane">
                <span className="comparison-caption">
                  <i
                    aria-hidden="true"
                    className="legend-swatch legend-after"
                  />
                  After
                </span>
                <button
                  aria-label="Open after image full screen"
                  className="image-trigger"
                  onClick={() => onPreview(after)}
                  type="button"
                >
                  <img alt={after.alt} src={after.src} />
                </button>
              </div>
            </div>
          </div>
        ) : mode === "difference" ? (
          <div className="comparison-scroll" key={mode}>
            <button
              aria-label="Open highlighted changes full screen"
              className="image-trigger difference-trigger"
              onClick={() => onPreview(difference)}
              type="button"
            >
              <img alt={difference.alt} src={difference.src} />
            </button>
          </div>
        ) : (
          <div className="comparison-scroll" key={mode}>
            <div className="comparison-key">
              <button onClick={() => onPreview(before)} type="button">
                <i aria-hidden="true" className="legend-swatch legend-before" />
                Before
                <span aria-hidden="true">↗</span>
              </button>
              {mode === "split" ? (
                <span>Drag the divider to compare</span>
              ) : (
                <div className="opacity-control">
                  <input
                    aria-label="Show after image"
                    max="100"
                    min="0"
                    onChange={(event) => setBlend(Number(event.target.value))}
                    type="range"
                    value={blend}
                  />
                  <output>{blend}%</output>
                </div>
              )}
              <button onClick={() => onPreview(after)} type="button">
                <i aria-hidden="true" className="legend-swatch legend-after" />
                After
                <span aria-hidden="true">↗</span>
              </button>
            </div>
            <div className="comparison-canvas">
              <img alt={before.alt} src={before.src} />
              <div
                aria-hidden="true"
                className="comparison-overlay"
                style={
                  mode === "split"
                    ? { clipPath: `inset(0 0 0 ${split}%)` }
                    : { opacity: blend / 100 }
                }
              >
                <img alt="" src={after.src} />
              </div>
              {mode === "split" && (
                <>
                  <div
                    aria-hidden="true"
                    className="comparison-divider"
                    style={{ left: `${split}%` }}
                  >
                    <span>↔</span>
                  </div>
                  <input
                    aria-label="Move the before-and-after slider"
                    aria-valuetext={`${split}% before, ${100 - split}% after`}
                    className="comparison-range comparison-range-overlay"
                    max="100"
                    min="0"
                    onChange={(event) => setSplit(Number(event.target.value))}
                    type="range"
                    value={split}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </section>
    );
  }

  const image =
    file.status === "removed" ? file.images.baseline : file.images.candidate;
  return previewButton(
    file.status === "added"
      ? "Added"
      : file.status === "removed"
        ? "Removed"
        : "Current",
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
  const [size, setSize] = useState<ImageScale>("actual");

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
          <div className="lightbox-title">
            <h2 id="image-lightbox-title">{image.label}</h2>
            <code>{image.file}</code>
          </div>
          <div className="lightbox-actions">
            <fieldset aria-label="Image size" className="lightbox-size">
              <button
                aria-pressed={size === "fit"}
                onClick={() => setSize("fit")}
                type="button"
              >
                Fit
              </button>
              <button
                aria-pressed={size === "actual"}
                onClick={() => setSize("actual")}
                type="button"
              >
                Full size
              </button>
            </fieldset>
            <a href={image.src} rel="noreferrer" target="_blank">
              Original ↗
            </a>
            <button
              aria-label="Close full-screen image"
              className="lightbox-close"
              onClick={() => dialog.current?.close()}
              type="button"
            >
              ×
            </button>
          </div>
        </header>
        <section
          aria-label={`${image.label} image`}
          className={`lightbox-canvas lightbox-canvas-${size}`}
        >
          <div className="lightbox-image-stage">
            <img alt={image.alt} src={image.src} />
          </div>
        </section>
      </div>
    </dialog>
  );
}

function ScreenshotList({
  groups,
  onSelect,
  selectedFile,
}: {
  groups: { files: VisualDiffFile[]; label: string }[];
  onSelect(file: string): void;
  selectedFile?: string;
}) {
  return groups.map(
    (group) =>
      group.files.length > 0 && (
        <section className="screenshot-group" key={group.label}>
          <h2>
            <span>{group.label}</span>
            <small>{group.files.length}</small>
          </h2>
          {screenshotBranches(group.files).map((branch) => (
            <div
              className={
                branch.label
                  ? "screenshot-tree-branch screenshot-tree-branch-grouped"
                  : "screenshot-tree-branch"
              }
              key={branch.key ? `parent:${branch.key}` : "root"}
            >
              {branch.label && <h3 title={branch.label}>{branch.label}</h3>}
              {branch.items.map(({ file, label }) => (
                <button
                  aria-label={`${displayName(file.file)}, ${file.status}`}
                  className={file.file === selectedFile ? "selected" : ""}
                  key={file.file}
                  onClick={() => onSelect(file.file)}
                  type="button"
                >
                  <span>{label}</span>
                  <small data-status={file.status}>{file.status}</small>
                </button>
              ))}
            </div>
          ))}
        </section>
      ),
  );
}

function ReportViewer({
  report,
  source,
}: {
  report: VisualDiffReport;
  source: ImageSource;
}) {
  const groups = useMemo(
    () => [
      {
        files: report.files
          .filter((file) => file.status !== "unchanged")
          .toSorted(compareScreenshotNames),
        label: "Changes",
      },
      {
        files: report.files
          .filter((file) => file.status === "unchanged")
          .toSorted(compareScreenshotNames),
        label: "Unchanged",
      },
    ],
    [report],
  );
  const changes = groups[0].files;
  const [selectedFile, setSelectedFile] = useState(
    changes.find((file) => file.status === "changed")?.file ??
      changes[0]?.file ??
      report.files[0]?.file,
  );
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const mobilePicker = useRef<HTMLDetailsElement>(null);
  const selected = report.files.find((file) => file.file === selectedFile);
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

  function selectScreenshot(file: string) {
    setSelectedFile(file);
    mobilePicker.current?.removeAttribute("open");
  }

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
          <span>
            <b>{report.summary.unchanged}</b> unchanged
          </span>
        </fieldset>
        <nav className="desktop-screenshot-nav" aria-label="Screenshots">
          <ScreenshotList
            groups={groups}
            onSelect={selectScreenshot}
            selectedFile={selectedFile}
          />
        </nav>
        {selected && (
          <details className="mobile-screenshot-picker" ref={mobilePicker}>
            <summary>
              <span>{displayName(selected.file)}</span>
              <small data-status={selected.status}>{selected.status}</small>
              <b aria-hidden="true">⌄</b>
            </summary>
            <nav aria-label="Screenshots">
              <ScreenshotList
                groups={groups}
                onSelect={selectScreenshot}
                selectedFile={selectedFile}
              />
            </nav>
          </details>
        )}
      </aside>
      <section className="panel review-stage">
        {selected ? (
          <>
            <header className="review-header">
              <div className="review-heading">
                <div className="review-title-row">
                  <h1>{displayName(selected.file)}</h1>
                  <span className="status-badge" data-status={selected.status}>
                    {selected.status}
                  </span>
                </div>
                <code>{selected.file}</code>
              </div>
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
            <h1>No screenshots.</h1>
            <p>This report does not contain any screenshots.</p>
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
        if (window.location.pathname.replace(/\/+$/, "") === "/guide") {
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
        const report = await loadReport(source);
        if (active) setState({ kind: "ready", report, source });
      } catch (error) {
        if (active) {
          setState({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "The report could not be loaded.",
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
      {state.kind === "setup" && <GuidePage />}
      {state.kind === "loading" && (
        <section className="status-panel panel">
          <div className="loading-pulse" />
          <p>Loading report…</p>
        </section>
      )}
      {state.kind === "error" && (
        <section className="status-panel panel error-panel">
          <p className="kicker">Report not found</p>
          <h1>Could not load this report.</h1>
          <p>{state.message}</p>
          <a href={window.location.href}>Try again</a>
        </section>
      )}
      {state.kind === "ready" && (
        <ReportViewer report={state.report} source={state.source} />
      )}
    </div>
  );
}
