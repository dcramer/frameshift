import { type VisualDiffFile, type VisualDiffReport } from "@frameshift/report";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import yaml from "highlight.js/lib/languages/yaml";
import { useEffect, useMemo, useRef, useState } from "react";

import { loadReport } from "./load-report";
import {
  adjacentScreenshot,
  reportArrowAction,
  type ReportQuickView,
  type ScreenshotDirection,
} from "./report-keyboard";
import {
  type ComparisonMode,
  type ImageScale,
  readReportView,
  writeReportView,
} from "./report-view";
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
const ACTION_REF = "v0";
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
const CONFIGURATION_EXAMPLE = `# In the e2e job
- uses: dcramer/frameshift/ci@${ACTION_REF}
  with:
    screenshots: test-output/screenshots
    saved-name: chromium             # separate browser or suite
    screenshot-retention-days: 60    # screenshots; default: 30
    report-retention-days: 14        # report before publishing; default: 7

# In the frameshift job
- uses: dcramer/frameshift/publish/workflow@${ACTION_REF}
  with:
    comment-on-no-changes: true       # default: false
    retention-days: 60               # published report; default: 30`;
const SEPARATE_STORAGE_EXAMPLE = `# Default-branch job
- name: Save screenshots
  uses: dcramer/frameshift/baseline/upload@${ACTION_REF}
  with:
    path: test-output/screenshots
    name: chromium
    retention-days: 60

# Pull request job
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

function targetUsesArrowKeys(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest("input, select, textarea, [contenteditable='true']") !==
        null)
  );
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
        <h1>Review screenshot changes in one place.</h1>
        <p>
          Frameshift compares screenshots before and after a code change, then
          adds a review link to the pull request.
        </p>
      </div>
      <div className="source-actions">
        <a className="source-card source-card-primary" href={SAMPLE_PATH}>
          <span>
            <strong>View the sample report</strong>
            <em>See changed, added, removed, and unchanged screenshots.</em>
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
            Save screenshots from your existing tests in one folder. Frameshift
            adds a review link to each pull request.
          </p>
        </header>

        <section className="setup-section">
          <p className="setup-step">Step 1</p>
          <h2>Save screenshots to one folder</h2>
          <p>
            Keep your existing screenshot code. Frameshift needs stable file
            names and one complete folder after the tests finish. Here is a
            Playwright example:
          </p>
          <CodeBlock code={PLAYWRIGHT_EXAMPLE} language="typescript" />
          <p>
            File names become labels. Folders and dots separate label parts. Use
            <code> __</code> for variants: <code>account__desktop.png</code> and
            <code> account__mobile.png</code> appear together under Account.
          </p>
          <p>
            Wait for fonts, data, and visible loading states before taking the
            screenshot. If shared test helpers wait for
            <code> aria-busy=&quot;true&quot;</code>, add it to loading regions.
          </p>
        </section>

        <section className="setup-section">
          <p className="setup-step">Step 2</p>
          <h2>Add Frameshift after the tests</h2>
          <p>
            Change the test command and screenshot folder below. The second job
            posts the GitHub check and comment. It does not run pull request
            code or rerun your tests.
          </p>
          <CodeBlock code={SETUP_WORKFLOW} language="yaml" />
        </section>

        <aside className="setup-warning">
          <strong>The first report may mark every screenshot as added.</strong>
          <p>
            This happens when Frameshift cannot find screenshots for the commit
            where the pull request began. After the workflow runs on the default
            branch, later pull requests have a saved set to compare.
          </p>
        </aside>

        <section className="setup-section setup-behavior">
          <h2>Good to know</h2>
          <ul className="setup-checklist">
            <li>Your project must be public on GitHub.</li>
            <li>
              Run the workflow for pull requests and every push to the default
              branch.
            </li>
            <li>
              Upload one complete screenshot folder. Missing files count as
              removed. Merge split test results first.
            </li>
            <li>Screenshots and published reports stay for 30 days.</li>
            <li>
              If every screenshot matches, Frameshift adds a passing check
              without a comment. Set
              <code> comment-on-no-changes: true</code> to add one.
            </li>
            <li>
              Frameshift skips pull requests from forks because they cannot
              safely read the saved screenshots or write results to the project.
            </li>
          </ul>
        </section>

        <section className="setup-section" id="configuration">
          <h2>Configuration</h2>
          <p>Add only the lines you need.</p>
          <CodeBlock code={CONFIGURATION_EXAMPLE} language="yaml" />

          <h3 id="advanced-storage">Separate storage steps</h3>
          <p>
            The main Action already stores and downloads screenshots. Use these
            steps only when those tasks run in different jobs. Use the same
            <code> name</code> in both places. The download fails if it cannot
            find screenshots for the exact commit GitHub tested.
          </p>
          <CodeBlock code={SEPARATE_STORAGE_EXAMPLE} language="yaml" />
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
  mode,
  onModeChange,
  onPreview,
  onScaleChange,
  quickView,
  scale,
  source,
}: {
  file: VisualDiffFile;
  mode: ComparisonMode;
  onModeChange(mode: ComparisonMode): void;
  onPreview(image: PreviewImage): void;
  onScaleChange(scale: ImageScale): void;
  quickView: ReportQuickView | null;
  scale: ImageScale;
  source: ImageSource;
}) {
  const [split, setSplit] = useState(50);
  const [blend, setBlend] = useState(50);

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
    const quickImage = quickView === "before" ? before : after;

    return (
      <section className="comparison-viewer" data-scale={scale}>
        <header className="comparison-toolbar">
          <fieldset className="scale-switch" aria-label="Image size">
            <button
              aria-label="Fit image"
              aria-pressed={scale === "fit"}
              data-label="Fit image"
              onClick={() => onScaleChange("fit")}
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
              onClick={() => onScaleChange("actual")}
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
                aria-pressed={!quickView && mode === item.value}
                data-label={item.label}
                key={item.value}
                onClick={() => onModeChange(item.value)}
                title={item.label}
                type="button"
              >
                <ComparisonModeIcon mode={item.value} />
                <span>{item.label}</span>
              </button>
            ))}
          </fieldset>
        </header>

        {quickView ? (
          <>
            <div
              aria-hidden="true"
              className="keyboard-view-cue"
              data-side={quickView}
            >
              {quickView === "before" && <kbd>←</kbd>}
              <span>
                <strong>{quickImage.label}</strong>
                <small>Esc to compare</small>
              </span>
              {quickView === "after" && <kbd>→</kbd>}
            </div>
            <div
              className="comparison-scroll keyboard-image-view"
              key={`keyboard-${quickView}`}
            >
              <button
                aria-label={`Open ${quickImage.label.toLowerCase()} image full screen`}
                className="image-trigger keyboard-image-trigger"
                onClick={() => onPreview(quickImage)}
                type="button"
              >
                <img alt={quickImage.alt} src={quickImage.src} />
              </button>
            </div>
          </>
        ) : mode === "side-by-side" ? (
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
  files,
  onSelect,
  selectedFile,
}: {
  files: VisualDiffFile[];
  onSelect(file: string): void;
  selectedFile?: string;
}) {
  return screenshotBranches(files).map((branch) => (
    <div
      className={
        branch.label
          ? "screenshot-tree-branch screenshot-tree-branch-grouped"
          : "screenshot-tree-branch"
      }
      key={branch.key ? `parent:${branch.key}` : "root"}
    >
      {branch.label && <h2 title={branch.label}>{branch.label}</h2>}
      {branch.items.map(({ file, label }) => (
        <button
          aria-label={`${displayName(file.file)}, ${file.status}`}
          className={file.file === selectedFile ? "selected" : ""}
          data-screenshot={file.file}
          key={file.file}
          onClick={() => onSelect(file.file)}
          type="button"
        >
          <span>{label}</span>
          <small data-status={file.status}>{file.status}</small>
        </button>
      ))}
    </div>
  ));
}

function ReportViewer({
  report,
  source,
}: {
  report: VisualDiffReport;
  source: ImageSource;
}) {
  const files = useMemo(
    () => report.files.toSorted(compareScreenshotNames),
    [report],
  );
  const changes = files.filter((file) => file.status !== "unchanged");
  const initialView = useMemo(
    () => readReportView(new URLSearchParams(window.location.search)),
    [],
  );
  const defaultSelectedFile =
    changes.find((file) => file.status === "changed")?.file ??
    changes[0]?.file ??
    report.files[0]?.file;
  const [selectedFile, setSelectedFile] = useState(
    report.files.some((file) => file.file === initialView.file)
      ? initialView.file
      : defaultSelectedFile,
  );
  const [mode, setMode] = useState<ComparisonMode>(
    initialView.mode ?? initialComparisonMode,
  );
  const [scale, setScale] = useState<ImageScale>(initialView.scale ?? "fit");
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const [quickView, setQuickView] = useState<ReportQuickView | null>(null);
  const [navigationDirection, setNavigationDirection] =
    useState<ScreenshotDirection | null>(null);
  const [keyboardAnnouncement, setKeyboardAnnouncement] = useState("");
  const mobilePicker = useRef<HTMLDetailsElement>(null);
  const selected = files.find((file) => file.file === selectedFile);
  const keyboardShortcuts = [
    "ArrowUp",
    "ArrowDown",
    ...(selected?.status === "changed" ? ["ArrowLeft", "ArrowRight"] : []),
    ...(quickView ? ["Escape"] : []),
  ].join(" ");
  const sourceDetails =
    source.kind === "github"
      ? {
          commitHref: `https://github.com/${source.repo}/commit/${source.ref}`,
          ref: source.ref,
          repo: source.repo,
          repoHref: `https://github.com/${source.repo}`,
        }
      : source.kind === "fixture"
        ? {
            commitHref: null,
            ref: null,
            repo: "dcramer/frameshift",
            repoHref: PROJECT_URL,
          }
        : null;
  const pullRequest = report.metadata?.pullRequest;
  const pullRequestHref =
    pullRequest?.number && sourceDetails
      ? `${sourceDetails.repoHref}/pull/${pullRequest.number}`
      : null;

  useEffect(() => {
    if (!selectedFile) return;
    const search = writeReportView(window.location.search, {
      file: selectedFile,
      mode,
      scale,
    });
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${search}${window.location.hash}`,
    );
  }, [mode, scale, selectedFile]);

  useEffect(() => {
    const selectedButton = [
      ...document.querySelectorAll<HTMLElement>(
        ".desktop-screenshot-nav button[data-screenshot]",
      ),
    ].find((button) => button.dataset.screenshot === selectedFile);
    selectedButton?.scrollIntoView({ block: "nearest" });
  }, [selectedFile]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        !selected ||
        previewImage ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        targetUsesArrowKeys(event.target)
      ) {
        return;
      }

      if (event.key === "Escape" && quickView) {
        event.preventDefault();
        setQuickView(null);
        setKeyboardAnnouncement("Showing the comparison again.");
        return;
      }

      const action = reportArrowAction(event.key, selected.status);
      if (!action) return;
      event.preventDefault();

      if (action.kind === "quick-view") {
        setQuickView(action.view);
        setKeyboardAnnouncement(
          `Showing the ${action.view} image for ${displayName(selected.file)}.`,
        );
        return;
      }

      const nextFile = adjacentScreenshot(
        files.map((file) => file.file),
        selected.file,
        action.offset,
      );
      if (!nextFile) return;
      const next = files.find((file) => file.file === nextFile)!;
      const focusedNavigation =
        event.target instanceof HTMLElement
          ? event.target.closest<HTMLElement>(".report-index nav")
          : null;
      setSelectedFile(nextFile);
      setNavigationDirection(action.direction);
      if (next.status !== "changed") setQuickView(null);
      mobilePicker.current?.removeAttribute("open");
      if (focusedNavigation) {
        window.requestAnimationFrame(() => {
          const nextButton = [
            ...focusedNavigation.querySelectorAll<HTMLElement>(
              "button[data-screenshot]",
            ),
          ].find((button) => button.dataset.screenshot === nextFile);
          nextButton?.focus();
        });
      }
      setKeyboardAnnouncement(
        `${displayName(next.file)}, ${next.status} screenshot.`,
      );
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [files, previewImage, quickView, selected]);

  function selectScreenshot(file: string) {
    setSelectedFile(file);
    setNavigationDirection(null);
    setQuickView(null);
    mobilePicker.current?.removeAttribute("open");
  }

  function selectMode(nextMode: ComparisonMode) {
    setMode(nextMode);
    setQuickView(null);
    try {
      window.localStorage.setItem(COMPARISON_MODE_STORAGE_KEY, nextMode);
    } catch {
      // The selected mode still works for this page when storage is blocked.
    }
  }

  return (
    <main className="report-layout">
      <header className="report-header">
        <a className="report-brand" href="/">
          <BrandMark />
          <span>Frameshift</span>
        </a>
        <div className="report-context">
          {sourceDetails && (
            <div className="report-github">
              <GitHubIcon />
              <a href={sourceDetails.repoHref}>{sourceDetails.repo}</a>
              {sourceDetails.ref && (
                <a
                  className="report-commit"
                  href={sourceDetails.commitHref ?? undefined}
                  title={sourceDetails.ref}
                >
                  <span>Commit</span>
                  <code>{sourceDetails.ref.slice(0, 7)}</code>
                </a>
              )}
            </div>
          )}
          {pullRequest && (
            <div className="report-pull-request">
              {pullRequest.number &&
                (pullRequestHref ? (
                  <a href={pullRequestHref}>PR #{pullRequest.number}</a>
                ) : (
                  <span>PR #{pullRequest.number}</span>
                ))}
              <strong title={pullRequest.title}>{pullRequest.title}</strong>
            </div>
          )}
        </div>
      </header>
      <aside className="panel report-index">
        <nav className="desktop-screenshot-nav" aria-label="Screenshots">
          <ScreenshotList
            files={files}
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
                files={files}
                onSelect={selectScreenshot}
                selectedFile={selectedFile}
              />
            </nav>
          </details>
        )}
      </aside>
      <section
        aria-keyshortcuts={keyboardShortcuts}
        className="panel review-stage"
      >
        {selected ? (
          <div
            className="review-content"
            data-navigation={navigationDirection ?? undefined}
            key={selected.file}
          >
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
              <div
                aria-label="Keyboard shortcuts: Up and down change screenshots. Left shows before. Right shows after."
                className="review-shortcuts"
                role="note"
              >
                <span>
                  <kbd>↑</kbd>
                  <kbd>↓</kbd> Screenshots
                </span>
                {selected.status === "changed" && (
                  <>
                    <span>
                      <kbd>←</kbd> Before
                    </span>
                    <span>
                      After <kbd>→</kbd>
                    </span>
                  </>
                )}
              </div>
            </header>
            <ImagePanel
              file={selected}
              mode={mode}
              onModeChange={selectMode}
              onPreview={setPreviewImage}
              onScaleChange={setScale}
              quickView={quickView}
              scale={scale}
              source={source}
            />
          </div>
        ) : (
          <div className="no-changes">
            <p className="kicker">Empty report</p>
            <h1>No screenshots to review.</h1>
          </div>
        )}
      </section>
      {previewImage && (
        <ImageLightbox
          image={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
      <output aria-live="polite" className="visually-hidden">
        {keyboardAnnouncement}
      </output>
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
          <p className="kicker">Report error</p>
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
