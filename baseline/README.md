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
      - uses: dcramer/frameshift/baseline/upload@88dd29021aa9b1d86a091fc45d96b6b76bc35847
        with:
          path: path/to/baseline
```

Restore the artifact for the exact base that GitHub tested before comparing it
with candidate screenshots. The default checkout must keep GitHub's synthetic
PR merge commit:

```yaml
permissions:
  actions: read
  contents: read

steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: dcramer/frameshift/baseline@88dd29021aa9b1d86a091fc45d96b6b76bc35847
    id: baseline
    with:
      path: path/to/baseline
```

The upload Action defaults to the `frameshift-baseline-v1` ID and
`github.sha`. The restore Action uses `github.token` and derives the exact base
from the checked-out PR merge commit. It verifies that the commit's second
parent is the PR head before it accepts the first parent as the base. This
avoids stale `pull_request.base.sha` event data.

Restore rejects expired artifacts and waits briefly when the default-branch
workflow is still uploading one. It does not silently regenerate a baseline.
A missing artifact is an actionable setup failure. The selected base is
available as `steps.baseline.outputs.sha`.

The immutable artifact key is the baseline ID plus the full source SHA.
Override `name` when the repository has multiple screenshot suites. Increment
its contract suffix when the browser or screenshot semantics become
incompatible. Pass `sha` or `github-token` only for workflows that cannot use
the safe pull-request defaults.

Capture all baseline scenarios in the default-branch workflow. A pull request
can capture a smaller candidate set, but it must select the matching files from
the restored baseline before comparison. Frameshift treats unmatched baseline
files as removed images.
