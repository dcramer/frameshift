# Save and download screenshots

Frameshift calls the screenshots from your default branch the `baseline`.
Take the full set after each change lands, then save it with GitHub Actions:

```yaml
on:
  push:
  workflow_dispatch:

jobs:
  screenshots:
    if: >-
      github.event_name == 'workflow_dispatch' ||
      github.ref_name == github.event.repository.default_branch
    runs-on: ubuntu-latest
    steps:
      - name: Take every screenshot
        run: pnpm capture:screenshots -- --all --output path/to/current-screenshots
      - uses: dcramer/frameshift/baseline/upload@2c52603751a6c29dbe3802587bec832ad1df0581
        with:
          path: path/to/current-screenshots
```

Before checking a pull request, download the set made from the exact
default-branch code that GitHub tested:

```yaml
permissions:
  actions: read
  contents: read

steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: dcramer/frameshift/baseline@2c52603751a6c29dbe3802587bec832ad1df0581
    id: baseline
    with:
      path: path/to/before
```

The save Action uses `frameshift-baseline-v1` as its name and `github.sha` as
the commit ID unless you override them. The download Action uses
`github.token`. It asks GitHub which default-branch commit the pull request was
tested against, so it does not depend on old event data or a full Git history.

The download Action refuses expired uploads and waits briefly if the
default-branch job is still saving one. It never creates a missing set. If no
set exists, the job fails and tells you which commit needs screenshots. The
selected commit ID is available as `steps.baseline.outputs.sha`.

Frameshift names each saved set with its shared name and full Git commit ID.
Use a different `name` when one project has more than one screenshot set.
Change the version at the end of the name when older screenshots can no longer
be compared with new ones. Set `sha` or `github-token` only in workflows that
cannot use the pull-request defaults.

Take every current screenshot in the default-branch job. A pull request may
take fewer screenshots, but select the matching files from the downloaded set
before comparing. Frameshift marks current screenshots with no matching new
file as removed.
