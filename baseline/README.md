# Baseline artifacts

Frameshift can store baseline screenshots in GitHub Actions artifacts. Capture
the complete baseline once on each configured default-branch commit. This job
condition works for `main`, `master`, or any other default branch:

```yaml
on:
  push:
  workflow_dispatch:

jobs:
  baseline:
    if: >-
      github.event_name == 'workflow_dispatch' ||
      github.ref_name == github.event.repository.default_branch
    runs-on: ubuntu-latest
    steps:
      - name: Capture baseline screenshots
        run: pnpm capture:screenshots -- --all --output path/to/baseline
      - uses: dcramer/frameshift/baseline/upload@<full-commit-sha>
        with:
          name: web-screenshots-v1
          sha: ${{ github.sha }}
          path: path/to/baseline
```

Restore the artifact for the pull request's exact base commit before comparing
it with candidate screenshots:

```yaml
permissions:
  actions: read
  contents: read

steps:
  - uses: dcramer/frameshift/baseline@<full-commit-sha>
    with:
      name: web-screenshots-v1
      sha: ${{ github.event.pull_request.base.sha }}
      path: path/to/baseline
      github-token: ${{ github.token }}
```

The upload Action names the artifact with the full source SHA. The restore
Action requires that exact SHA, rejects expired artifacts, and waits briefly
when the default-branch workflow is still uploading it. It does not silently
regenerate a baseline. A missing artifact is an actionable setup failure.

`name` is a repository-scoped baseline ID. Include a capture-contract version
and increment it when the browser or screenshot semantics become incompatible.
The immutable artifact key is the baseline ID plus the full source SHA.

Capture all baseline scenarios in the default-branch workflow. A pull request
can capture a smaller candidate set, but it must select the matching files from
the restored baseline before comparison. Frameshift treats unmatched baseline
files as removed images.
