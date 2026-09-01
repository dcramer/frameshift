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

## Use the GitHub Action

Your app takes the screenshots. Add one Frameshift step after that command.
Use the same workflow for pushes to your default branch and pull requests:

```yaml
name: Check screenshots

on:
  push:
  pull_request:
  workflow_dispatch:

permissions:
  actions: read
  contents: read

jobs:
  screenshots:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      # Set up your app and browser here.
      - name: Take screenshots
        run: pnpm capture:screenshots -- --all --output "${{ runner.temp }}/screenshots"
      - uses: dcramer/frameshift/ci@2c52603751a6c29dbe3802587bec832ad1df0581
        with:
          screenshots: ${{ runner.temp }}/screenshots
```

After a push to the default branch, Frameshift saves the screenshots with the
full Git commit ID. On a pull request, it downloads that exact set, compares
it with the new screenshots, and saves the report for the publishing job.

Pull requests from forks are skipped because fork code must not receive the
Actions read token. See [`baseline/README.md`](baseline/README.md) if you need
more than one screenshot set or want to use the lower-level Actions.

Use full Git commit IDs for Frameshift and every other third-party Action. The
`changes` output counts screenshots that changed, were added, or were removed.
A screenshot change does not fail the Action.

Make screenshot runs repeatable. Use fixed test data, the same browser and
window size, a fixed language and time zone, loaded fonts, reduced motion, and
no animation. The same relative PNG path means the same page in both sets.

Reports contain `report.json` and the images needed for review. A changed
screenshot has before, after, and highlighted-change images. A new or removed
screenshot has the one available image.

## Add the report to GitHub

Publish from a separate job on your default branch after the screenshot check
finishes. This job does not run pull-request code:

```yaml
on:
  workflow_run:
    workflows: [Check screenshots]
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
      - uses: dcramer/frameshift/publish/workflow@2c52603751a6c29dbe3802587bec832ad1df0581
```

The publishing Action downloads the report, checks every file, saves it under
a Git tag that never moves, and adds a GitHub status and pull request comment.
The comment shows the after screenshots and links to the full report:

```text
https://frameshift.pub/report/?repo=owner/project&ref=0123456789abcdef0123456789abcdef01234567
```

Only this publishing job needs `contents: write` and `statuses: write`. Never
give write access to a job that runs pull-request code. These examples skip
pull requests from forks because downloading saved screenshots needs an
Actions read token, which fork code must not receive.

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
