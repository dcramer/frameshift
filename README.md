# Frameshift

Frameshift compares two sets of PNG screenshots and gives reviewers one page
to inspect them. Its GitHub Action builds the report. The website is made of
static files and reads reports saved in GitHub.

Frameshift does not run a server or store your data.

## Project folders

- `apps/web`: The review website.
- `packages/action`: Screenshot comparison and GitHub Action code.
- `packages/report`: Report format and safety checks.
- `ci/`: The one-step Action used after your screenshot command.
- `action.yml` and `dist/`: The comparison Action and the file GitHub runs.
- `baseline/`: Actions that save and download current screenshots.
- `publish/action.yml` and `publish/dist/`: The Action that saves a report and
  links it from GitHub.

## Add Frameshift to CI

Keep your current screenshot tests. Add one Frameshift step after they write a
complete folder of PNG files. Run the same job for pull requests and your
default branch.

This is a complete workflow. Replace the setup command, screenshot command,
and `screenshots` path with the ones your project already uses. If your test
job has another ID, use that ID in `needs`:

```yaml
name: CI

on:
  push:
  pull_request:
  workflow_dispatch:

permissions:
  actions: read
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      # Set up your app and browser here.
      - name: Run screenshot tests
        run: pnpm test:screenshots
      - name: Record screenshot test results
        uses: dcramer/frameshift/ci@43268de9ab851991f7240217636d475806c15ae2
        with:
          screenshots: path/to/test-output/screenshots

  frameshift:
    needs: test
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: write
      pull-requests: write
      statuses: write
    steps:
      # This job never checks out or runs pull request code.
      - uses: dcramer/frameshift/publish/workflow@43268de9ab851991f7240217636d475806c15ae2
```

The test job runs once. Frameshift does not take screenshots or rerun tests. On
the default branch, it saves the completed screenshots under the full Git
commit ID. On a pull request, it downloads that exact set, compares it with the
screenshots the test just wrote, and saves the report as another GitHub Actions
upload.

The small `frameshift` job downloads that report. It checks every file, saves
the report under a Git tag that never moves, and adds the pull request comment
and commit status. The separate job is a permission boundary, not a second test
run. It never checks out pull request code.

Frameshift skips non-default pushes and pull requests from forks. It fails with
a clear error when the screenshot folder is empty or the exact saved set is
missing. It never chooses a nearby set or silently makes a new one.

Run this workflow on the default branch once before expecting a pull request
report. That first run saves the first screenshot set. Do not use a path filter
that can skip a commit which later becomes a pull request base.

Your test must write the same complete screenshot set on both revisions. Make
runs repeatable with fixed test data, the same browser and window size, a fixed
language and time zone, loaded fonts, reduced motion, and no animation. The
same relative PNG path means the same page in both sets.

Reports contain `report.json` and the images needed for review. A changed
screenshot has before, after, and highlighted-change images. A new or removed
screenshot has the one available image.

The comment shows the after screenshots and links to the full report:

```text
https://frameshift.pub/report/?repo=owner/project&ref=0123456789abcdef0123456789abcdef01234567
```

Frameshift currently supports public GitHub projects. The static website loads
report files directly from GitHub and cannot sign in to a private project.

Reports live behind orphan `frameshift-report/*` tags. Normal shallow clones
and `actions/checkout` do not download those report objects. A command that
explicitly fetches every tag will download them, and GitHub stores them until
their tags are removed. This is the storage tradeoff that keeps Frameshift
static and free of repository tokens.

See [`baseline/README.md`](baseline/README.md) for retention and lower-level
settings. Use full Git commit IDs for Frameshift and every third-party Action.

## Run locally

```sh
corepack enable
pnpm install
pnpm dev
```

Open the local URL and enter a public GitHub project plus the full Git commit
ID that contains `report.json` and its `images/` folder.

Select **View the sample report** or open `/sample/` to see changed, new,
removed, and matching pages. The sample ships with the website and makes no
outside request.

Start there directly while working on the review UI:

```sh
pnpm dev:fixture
```

You can also open a saved GitHub report directly:

```text
http://localhost:5173/report/?repo=owner/project&ref=0123456789abcdef0123456789abcdef01234567
```

### Create and view a local report

A report is a folder containing `report.json` and every image named in that
file. Create one from two PNG folders:

```sh
pnpm compare -- \
  --baseline path/to/before \
  --candidate path/to/after \
  --output .frameshift/report
```

Check and open that folder:

```sh
pnpm report:check -- .frameshift/report
pnpm dev:report -- .frameshift/report
```

`dev:report` accepts the report folder or its `report.json` file. It checks the
report and refuses missing files, extra files, and symbolic links before it
serves anything. `.frameshift` is ignored by Git.

## Report format

`packages/report` defines what `report.json` may contain. The generated
[JSON Schema](schemas/report-v2.schema.json) lets tools written in other
languages create reports. After changing the format, run
`pnpm schema:build`. Project checks fail if the generated file is out of date.

Report version 2 stores before, after, and highlighted-change images for a
changed screenshot. New and matching screenshots use the after image. Removed
screenshots use the before image. This keeps every screenshot available for
review.

Every path is relative to `report.json`. The website checks paths before it
creates image URLs.

The `fixtures/mixed` folder is the sample report. It covers changed, new,
removed, and matching screenshots. Rebuild and check it with:

```sh
pnpm fixture:generate
pnpm fixtures:check
```

## Work on the Action

Run the comparison without GitHub Actions:

```sh
pnpm compare -- \
  --baseline path/to/before \
  --candidate path/to/after \
  --output path/to/report
```

After changing Action code or its dependencies, rebuild the file that GitHub
runs:

```sh
pnpm action:build
```

Tests fail when `dist/index.mjs` or its license notices do not match the source.

Run a quick end-to-end check of the built Action:

```sh
pnpm action:smoke
```

The `Action self-test` workflow runs the checked-out Action on every pull
request and push to `main`. It checks the reported change count and every
report file. It also saves the report, adds a `Frameshift` status, and keeps the
GitHub Actions upload for seven days. Run the workflow by hand when you need to
test the current `main` branch again.
