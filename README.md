# Frameshift

Frameshift compares PNG screenshots and turns the resulting visual-diff
reports into a focused review interface. Its reusable GitHub Action creates the
report. Its static web app displays reports stored at immutable Git revisions.

The first version is a static Vercel app. GitHub serves report JSON and image
files. Frameshift does not need a database, object storage, or server-side
runtime.

## Repository layout

- `apps/web`: Static report viewer.
- `packages/action`: PNG comparison and GitHub Action source.
- `packages/report`: Versioned report types and validation.
- `action.yml` and `dist/`: Token-free comparison Action and bundle.
- `baseline/`: Exact-SHA baseline artifact upload and restore Actions.
- `publish/action.yml` and `publish/dist/`: GitHub publisher Action and bundle.

## Use the GitHub Action

Frameshift compares PNG files. Your application owns the screenshot command.
Run the expensive baseline capture once for each default-branch commit and
store it in GitHub Actions artifacts:

```yaml
name: Visual baseline

on:
  push:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  baseline:
    if: >-
      github.event_name == 'workflow_dispatch' ||
      github.ref_name == github.event.repository.default_branch
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      # Set up the application and its browser here.
      - name: Capture every baseline screenshot
        run: pnpm capture:screenshots -- --all --output path/to/baseline
      - uses: dcramer/frameshift/baseline/upload@88dd29021aa9b1d86a091fc45d96b6b76bc35847
        with:
          path: path/to/baseline
```

The pull request workflow restores the artifact for the exact base that GitHub
tested. Keep the default checkout behavior so Frameshift can verify the PR
merge commit and derive its immutable first parent. The workflow only captures
the candidate revision:

```yaml
name: Visual diff

on:
  pull_request:

permissions:
  actions: read
  contents: read

jobs:
  visual-diff:
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      # Set up the application and its browser here.
      - name: Capture candidate screenshots
        run: pnpm capture:screenshots -- --output "${{ runner.temp }}/frameshift/candidate"
      - uses: dcramer/frameshift/baseline@88dd29021aa9b1d86a091fc45d96b6b76bc35847
        id: baseline
        with:
          path: ${{ runner.temp }}/frameshift/baseline
      - name: Compare screenshots
        id: visual-diff
        uses: dcramer/frameshift@88dd29021aa9b1d86a091fc45d96b6b76bc35847
        with:
          baseline: ${{ runner.temp }}/frameshift/baseline
          candidate: ${{ runner.temp }}/frameshift/candidate
          output: ${{ runner.temp }}/frameshift/report
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: frameshift-report
          path: ${{ runner.temp }}/frameshift/report
          if-no-files-found: error
```

That is the complete baseline plumbing. The Actions default to the
`frameshift-baseline-v1` baseline ID, the current SHA during upload, and the
workflow token during restore. The restore Action outputs the selected SHA as
`steps.baseline.outputs.sha` when another step needs to validate a manifest.

The restore Action checks the artifact name and source SHA. It waits briefly
when the default-branch workflow is still uploading. It does not silently
regenerate a missing baseline. See [`baseline/README.md`](baseline/README.md)
for overrides, retention, and partial-capture details.

Override `name` only when the repository has multiple screenshot suites or
when a capture-contract change must invalidate existing artifacts. Restore
uses this ID plus the full base SHA; it never follows a branch name or chooses
a nearby artifact.

Pin Frameshift and other third-party actions to full commit SHAs. The
`changes` output counts changed, added, and removed images. A visual change does
not fail the action.

Your capture command must make both revisions reproducible. Use fixed test
data, a mock API, pinned browser versions, explicit viewports, a fixed locale
and timezone, loaded fonts, reduced motion, and disabled animations. Matching
relative PNG paths identify the same screenshot.

The output directory contains `report.json` and only the images required for
review. Changed pairs include baseline, candidate, and pixel-diff images. Added
or removed files include only the available image.

The action reads and writes local files only. It does not call the GitHub API
and does not need a token.

## Publish a GitHub report

Keep the Vercel app static. Run Frameshift's publisher after the untrusted pull
request workflow completes. The wrapper downloads `frameshift-report` from the
completed run, validates it, and publishes it:

```yaml
on:
  workflow_run:
    workflows: [Visual diff]
    types: [completed]

permissions:
  actions: read
  contents: write
  pull-requests: write
  statuses: write

jobs:
  publish:
    if: >-
      github.event.workflow_run.conclusion == 'success' &&
      github.event.workflow_run.pull_requests[0] != null &&
      github.event.workflow_run.head_repository.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: dcramer/frameshift/publish/workflow@88dd29021aa9b1d86a091fc45d96b6b76bc35847
```

The publisher validates the Zod report contract, preserves the report with an
immutable Git tag, and creates a native commit status. Its pull request comment
contains a compact change summary, candidate thumbnails, and a link to the
review UI:

```text
https://frameshift.pub/report/?repo=owner/repository&ref=0123456789abcdef0123456789abcdef01234567
```

The `Action self-test` workflow proves this flow in this repository. Report
tags do not trigger Vercel preview deployments.

Only the publishing job receives `contents: write` and `statuses: write`.
Frameshift's comparison Action remains token-free. The examples skip fork pull
requests because baseline restore needs an Actions read token and untrusted
pull request code must not receive it.

## Run locally

```sh
corepack enable
pnpm install
pnpm dev
```

Open the local URL and enter a public GitHub repository plus the immutable
commit SHA that contains `report.json` and its `images/` directory.

Select **View the sample report** to open the committed mixed-change fixture. The
static production build includes this fixture, so the sample works on the live
site without a server or external request.

Start directly in the committed mixed-change fixture when working on the
review UI:

```sh
pnpm dev:fixture
```

This opens `/sample/`. The same fixture is available in a normal dev server at
that path.

You can also open a report directly:

```text
http://localhost:5173/report/?repo=owner/repository&ref=0123456789abcdef0123456789abcdef01234567
```

### Generate and view a local report

Frameshift produces a report bundle, not a standalone JSON file. The bundle
contains `report.json` plus each image referenced by that report. Generate one
from two PNG directories:

```sh
pnpm compare -- \
  --baseline path/to/baseline \
  --candidate path/to/candidate \
  --output .frameshift/report
```

Validate and open that exact output in the local viewer:

```sh
pnpm report:check -- .frameshift/report
pnpm dev:report -- .frameshift/report
```

`dev:report` accepts either the bundle directory or its `report.json` path. It
validates the Zod contract and rejects missing, extra, or linked files before
it serves anything. `.frameshift` is ignored by Git.

## Report contract

`packages/report` owns the versioned Zod parser. TypeScript types are inferred
from that schema. The generated [JSON Schema](schemas/report-v2.schema.json)
supports producers in other languages. Run `pnpm schema:build` after an
intentional schema change; CI rejects a stale generated schema.

Report version 2 gives changed images baseline, candidate, and diff files.
Added and unchanged images use the candidate capture. Removed images use the
baseline capture. This keeps every screenshot available in the review report.

All report paths are relative to `report.json`. The viewer validates them
before it creates image URLs.

The committed `fixtures/mixed` report covers changed, added, removed, and
unchanged files. Regenerate it through the real comparison code and validate
all fixture schemas and image references with:

```sh
pnpm fixture:generate
pnpm fixtures:check
```

## Develop the action

Run the comparison without GitHub Actions:

```sh
pnpm compare -- \
  --baseline path/to/baseline \
  --candidate path/to/candidate \
  --output path/to/report
```

After action source or dependencies change, rebuild the committed bundle:

```sh
pnpm action:build
```

Tests fail when `dist/index.mjs` or its third-party license notices do not match
the source.

Run the bundled action against changed, added, and removed PNG fixtures:

```sh
pnpm action:smoke
```

The `Action self-test` workflow invokes the checked-out action through
`uses: ./` on every pull request and push to `main`. It uses deterministic PNG
inputs and verifies the change count, complete report, schema, and referenced
images. The workflow publishes the report at an immutable Git commit, links it
from a native `Frameshift` status, and retains the workflow artifact for seven
days. Run the workflow manually from GitHub when you need to test the current
`main` branch again.
