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
- `action.yml` and `dist/`: Published GitHub Action entry point and bundle.

## Use the GitHub Action

Capture baseline and candidate PNG files before this step. Matching relative
paths identify the same screenshot.

```yaml
permissions:
  contents: read

steps:
  - uses: actions/checkout@<full-commit-sha>
  - name: Compare screenshots
    id: visual-diff
    uses: dcramer/frameshift@<full-commit-sha>
    with:
      baseline: path/to/baseline
      candidate: path/to/candidate
      output: path/to/report
  - name: Show change count
    run: echo "${{ steps.visual-diff.outputs.changes }} visual changes"
```

Pin Frameshift and other third-party actions to full commit SHAs. The
`changes` output counts changed, added, and removed images. A visual change does
not fail the action.

The output directory contains `report.json` and only the images required for
review. Changed pairs include baseline, candidate, and pixel-diff images. Added
or removed files include only the available image.

The action reads and writes local files only. It does not call the GitHub API
and does not need a token.

## Run locally

```sh
corepack enable
pnpm install
pnpm dev
```

Open the local URL and enter a public GitHub repository plus the immutable
commit SHA that contains `report.json` and its `images/` directory.

Start directly in the committed mixed-change fixture when working on the
review UI:

```sh
pnpm dev:fixture
```

This opens `/?fixture=mixed`. The same fixture is available in a normal dev
server at that path.

You can also open a report directly:

```text
http://localhost:5173/?repo=owner/repository&ref=40-character-commit-sha
```

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
images. The check summary shows the result and retains the generated report
for seven days. Run the workflow manually from GitHub when you need to test the
current `main` branch again.
