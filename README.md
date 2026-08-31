# Scanner Sweep

Scanner Sweep turns visual-diff reports into a focused review interface. It is
designed for reports created in GitHub Actions and stored at immutable Git
revisions.

The first version is a static Vercel app. GitHub serves report JSON and image
files. Scanner Sweep does not need a database, object storage, or server-side
runtime.

## Repository layout

- `apps/web`: Static report viewer.
- `packages/report`: Versioned report types and validation.

The reusable GitHub Action will join the repository after the report boundary
is stable.

## Run locally

```sh
corepack enable
pnpm install
pnpm dev
```

Open the local URL and enter a public GitHub repository plus the immutable
commit SHA that contains `report.json` and its `images/` directory.

You can also open a report directly:

```text
http://localhost:5173/?repo=owner/repository&ref=40-character-commit-sha
```

## Report contract

The initial contract matches Scanner Sweep report version 1. Matching changed
images have baseline, candidate, and diff files. Added and removed images have
only the available side. Unchanged images have no published review image.

All report paths are relative to `report.json`. The viewer validates them
before it creates image URLs.
