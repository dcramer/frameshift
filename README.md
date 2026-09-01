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
      - uses: actions/checkout@<full-commit-sha>
      # Set up the application and its browser here.
      - name: Capture every baseline screenshot
        run: pnpm capture:screenshots -- --all --output path/to/baseline
      - uses: dcramer/frameshift/baseline/upload@<full-commit-sha>
        with:
          name: web-screenshots-v1
          sha: ${{ github.sha }}
          path: path/to/baseline
```

The pull request workflow restores the artifact for its exact base SHA. It
only captures the candidate revision:

```yaml
on:
  pull_request:

permissions:
  actions: read
  contents: read

jobs:
  visual-diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<full-commit-sha>
      # Set up the application and its browser here.
      - name: Capture candidate screenshots
        run: pnpm capture:screenshots -- --output "${{ runner.temp }}/frameshift/candidate"
      - uses: dcramer/frameshift/baseline@<full-commit-sha>
        with:
          name: web-screenshots-v1
          sha: ${{ github.event.pull_request.base.sha }}
          path: ${{ runner.temp }}/frameshift/baseline
          github-token: ${{ github.token }}
      - name: Compare screenshots
        id: visual-diff
        uses: dcramer/frameshift@<full-commit-sha>
        with:
          baseline: ${{ runner.temp }}/frameshift/baseline
          candidate: ${{ runner.temp }}/frameshift/candidate
          output: ${{ runner.temp }}/frameshift/report
```

The restore Action checks the artifact name and source SHA. It waits briefly
when the default-branch workflow is still uploading. It does not silently
regenerate a missing baseline. See [`baseline/README.md`](baseline/README.md)
for retention and partial-capture details.

`name` is the baseline ID. Include a capture-contract version in it when
browser or screenshot semantics can change, such as `web-screenshots-v1`.
Restore uses this ID plus the full base SHA; it never follows a branch name or
chooses a nearby artifact.

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

Keep the Vercel app static. Pass the report artifact to Frameshift's publisher
from a trusted job on the default branch:

```yaml
permissions:
  contents: write
  pull-requests: write
  statuses: write

steps:
  - uses: actions/download-artifact@<full-commit-sha>
    with:
      name: frameshift-report
      path: ${{ runner.temp }}/frameshift-report
  - uses: dcramer/frameshift/publish@<full-commit-sha>
    with:
      report: ${{ runner.temp }}/frameshift-report
      github-token: ${{ secrets.GITHUB_TOKEN }}
      head-sha: ${{ github.event.workflow_run.head_sha }}
      pull-request: ${{ github.event.workflow_run.pull_requests[0].number }}
```

The publisher validates the Zod report contract, preserves the report with an
immutable Git tag, and creates a native commit status. Its pull request comment
contains a compact change summary, candidate thumbnails, and a link to the
review UI:

```text
https://frameshift.pub/report/?repo=owner/repository&ref=report-commit-sha
```

The `Action self-test` workflow proves this flow in this repository. Report
tags do not trigger Vercel preview deployments.

Only the publishing job receives `contents: write` and `statuses: write`.
Frameshift's comparison Action remains token-free. Publishing is skipped for
fork pull requests because GitHub correctly gives those workflows read-only
tokens.

## Run locally

```sh
corepack enable
pnpm install
pnpm dev
```

Open the local URL and enter a public GitHub repository plus the immutable
commit SHA that contains `report.json` and its `images/` directory.

You can also select **Open report folder** on the home page. Choose the complete
report bundle. The browser validates `report.json`, checks every referenced
image, and displays it without uploading any file. A report with no visual
changes can use a folder that contains only `report.json`.

Select **View sample report** to open the committed mixed-change fixture. The
static production build includes this fixture, so the sample works on the live
site without a server or external request.

Start directly in the committed mixed-change fixture when working on the
review UI:

```sh
pnpm dev:fixture
```

This opens `/report/?fixture=mixed`. The same fixture is available in a normal dev
server at that path.

You can also open a report directly:

```text
http://localhost:5173/report/?repo=owner/repository&ref=40-character-commit-sha
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
from that schema. The generated [JSON Schema](schemas/report-v1.schema.json)
supports producers in other languages. Run `pnpm schema:build` after an
intentional schema change; CI rejects a stale generated schema.

Report version 1 gives changed images baseline, candidate, and diff files.
Added and removed images have only the available side. Unchanged images have no
published review image.

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
