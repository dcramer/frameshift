# Frameshift

Frameshift compares screenshots before and after a code change. It adds a small
preview to the pull request and links to a full report.

[View the sample report](https://frameshift.pub/sample/) ·
[Read the setup guide](https://frameshift.pub/guide/)

Frameshift uses the screenshot tests you already run. It does not rerun them.
Each report stays in the GitHub project that made it. There is no Frameshift
server, account, or database.

Frameshift supports public GitHub projects. The pull request branch must belong
to the same project. Frameshift skips pull requests from forks.

Frameshift comments only when a screenshot changed, was added, or was removed.
It still adds a passing check when every screenshot matches.

## Setup

Keep your existing screenshot tests. Make them write one complete folder of PNG
files. For example, with Playwright:

```ts
import { test } from "@playwright/test";

test("account settings", async ({ page }) => {
  await page.goto("/settings");
  await page.screenshot({
    path: "test-output/screenshots/settings.png",
    fullPage: true,
  });
});
```

File names become labels. Use `__` for variants: `account__desktop.png` and
`account__mobile.png` appear together under **Account**.

Add Frameshift after those tests:

```yaml
name: Screenshot checks

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
        uses: dcramer/frameshift/ci@68a8b5e8bbd439088ef9a044e693c5de9efe7ecd
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
      - uses: dcramer/frameshift/publish/workflow@68a8b5e8bbd439088ef9a044e693c5de9efe7ecd
```

Merge the workflow and let it finish on the default branch once. That run saves
the screenshots Frameshift will use before your first pull request.

The [configuration guide](https://frameshift.pub/guide/#configuration) shows how
to keep screenshots and reports longer, name more than one screenshot set, or
save and download screenshots in separate jobs.

## Development

Enable Corepack, install the pinned packages, and open the sample report:

```sh
corepack enable
pnpm install
pnpm dev:fixture
```

Run every project check:

```sh
pnpm check
```

This checks formatting, code quality, types, tests, generated files, packages,
and production builds.

## Local reports

Create a report from two complete folders of PNG files:

```sh
pnpm compare -- \
  --baseline path/to/before \
  --candidate path/to/after \
  --output .frameshift/report
```

Check and open it:

```sh
pnpm report:check -- .frameshift/report
pnpm dev:report -- .frameshift/report
```

`dev:report` rejects missing files, extra files, and symbolic links before it
serves the report.

## Report format

[`packages/report`](packages/report) owns the versioned Zod schema. Tools written
in other languages can use the generated
[JSON Schema](schemas/report-v2.schema.json).

A changed screenshot includes before, after, and highlighted-change images.
New and matching screenshots use the after image. Removed screenshots use the
before image. Every path is relative to `report.json` and is checked before the
viewer creates an image URL.

Reports created for a pull request also include its title and number under
`metadata.pullRequest`. The `metadata` object is optional, so reports created
from local folders remain valid.

The [`fixtures/mixed`](fixtures/mixed) report covers every status. Rebuild and
check it with:

```sh
pnpm fixture:generate
pnpm fixtures:check
```

## GitHub Action development

The checked-in Action must match its source. Rebuild and test it after changing
Action code or dependencies:

```sh
pnpm action:build
pnpm action:smoke
```

The `Action self-test` workflow also runs the checked-in Action on pull requests
and pushes to `main`.

## Project layout

- `apps/web`: static report viewer and setup guide.
- `packages/action`: PNG comparison and report publishing.
- `packages/report`: report format and checks.
- `ci`: one-step Action for normal CI workflows.
- `baseline`: save and find screenshots from earlier runs.
- `publish`: save reports and update GitHub.
- `fixtures`: generated reports for tests and local UI work.

## License

Licensed under the [Apache License 2.0](LICENSE).
