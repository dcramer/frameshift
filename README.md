# Frameshift

Frameshift turns screenshot test output into a focused GitHub pull request
review. It compares PNG files, adds a small thumbnail grid to the pull request,
and links to a full before-and-after report.

[View the sample report](https://frameshift.pub/sample/) ·
[Set up Frameshift](https://frameshift.pub/setup/)

Frameshift uses the screenshot tests you already run. It does not rerun them.
The viewer is a static website, and reports remain in the project that created
them. There is no Frameshift server, account, or database.

Frameshift currently supports public GitHub projects and same-project pull
requests. Fork pull requests are skipped.

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

The check covers formatting, lint, types, tests, generated files, dependencies,
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

[`packages/report`](packages/report) owns the versioned Zod schema. The
generated [JSON Schema](schemas/report-v2.schema.json) supports report producers
written in other languages.

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
- `packages/report`: report schema and validation.
- `ci`: one-step Action for normal CI workflows.
- `baseline`: lower-level baseline storage Actions.
- `publish`: write-scoped report delivery Actions.
- `fixtures`: generated reports for tests and local UI work.

## License

Licensed under the [Apache License 2.0](LICENSE).
