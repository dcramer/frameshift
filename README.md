# Frameshift

Frameshift compares screenshots before and after a code change. It adds a small
preview to the pull request and links to a full report.

[View the sample report](https://frameshift.pub/sample/) ·
[Set up Frameshift](https://frameshift.pub/setup/)

Frameshift uses the screenshot tests you already run. It does not rerun them.
Each report stays in the GitHub project that made it. There is no Frameshift
server, account, or database.

Frameshift supports public GitHub projects. The pull request branch must belong
to the same project. Frameshift skips pull requests from forks.

Frameshift comments only when a screenshot changed, was added, or was removed.
It still adds a passing check when every screenshot matches.

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

Use [`baseline/README.md`](baseline/README.md) for lower-level screenshot storage
and retention options.

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
