# Agent Instructions

## Purpose

Frameshift is a static screenshot comparison viewer. It also owns a reusable
GitHub Action for creating screenshot reports.

## Core Rules

- Write concise, direct prose. Use short sentences and active voice.
- Prefer the smallest design that closes a proven need.
- Use `pnpm`. Do not use npm or Yarn.
- Keep the web app static. Do not add a server, database, or Vercel Function
  without a requirement that needs one.
- Treat reports and images as untrusted input.
- Keep GitHub permissions and repository ownership explicit at each boundary.
- Use original science-fiction visuals. Do not copy game assets, logos, fonts,
  sound effects, or protected interface artwork.

## Versions

- Node.js: 24.20.0
- pnpm: 11.24.0

## Commands

- Install: `pnpm install`
- Develop: `pnpm dev`
- Develop with the mixed sample report: `pnpm dev:fixture`
- Develop with any local report: `pnpm dev:report -- <report-directory>`
- Build: `pnpm build`
- Rebuild the action: `pnpm action:build`
- Test the built Action: `pnpm action:smoke`
- Compare PNG folders: `pnpm compare -- --baseline <dir> --candidate <dir> --output <dir>`
- Check a report folder: `pnpm report:check -- <report-directory>`
- Rebuild the mixed sample report: `pnpm fixture:generate`
- Check saved sample reports: `pnpm fixtures:check`
- Regenerate the public JSON Schema: `pnpm schema:build`
- Test: `pnpm test`
- Check types: `pnpm typecheck`
- Check code style: `pnpm lint`
- Format: `pnpm format`
- Run all checks: `pnpm check`

## Architecture

- `apps/web` owns the static review interface.
- `packages/report` owns the versioned report format and its checks.
- `fixtures` contains reports made by the Action for local UI work and tests
  across packages. Do not hand-edit generated sample files.
- `schemas` contains generated JSON Schema files for external report producers.
- `packages/action` owns PNG comparison, report generation, and the GitHub
  Action entry point. It must not import the web app.
- `ci` owns the one-step Action that saves current screenshots or compares pull
  request screenshots.
- `action.yml` and `dist/` are the files users run as a GitHub Action.
- `frameshift-reports` starts the report-only Git history. Each saved report
  uses a `frameshift-report/*` tag that never moves, so Vercel does not deploy
  report data.
- The web app can import the report package.
- Use full Git commit IDs for report URLs. Do not load reports from a branch
  name that can move.
- Load public report files directly from `raw.githubusercontent.com`. Do not
  proxy image bytes through Vercel.

## Security Boundaries

- Validate every report before rendering it.
- Reject absolute paths, backslashes, path traversal, and unexpected image
  locations.
- Render report labels and paths as text. Do not use raw HTML.
- Never place a GitHub token in client code.
- The comparison Action must not require project or GitHub API permissions.
  The `ci` Action may read saved Actions files but must not write to the
  project. Use full Git commit IDs for third-party workflow Action versions.
- Keep report and status write permissions in the publishing job. Do not give
  them to the comparison Action or jobs that run untrusted pull request code.
- Make sure generated Action files can be rebuilt exactly, and check them in
  the project workflow.

## Workflow

- Search every reader and writer before changing the report format.
- Update the format everywhere at once unless older reports must keep working.
- Add tests at the package that owns the changed behavior.
- Keep direct packages current. Match Node type definitions to the supported
  Node version instead of using types from a newer version.
- After changes, run the smallest relevant tests, type check, style checks, and
  formatting checks. Run `pnpm check` before review when practical.
- Keep durable decisions in this file, the README, or code beside the owning
  boundary. Do not keep completed implementation plans.
