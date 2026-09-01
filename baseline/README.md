# Save and find screenshots

The main [`ci` Action](../ci/action.yml) handles this for most projects. Use it
after your tests in a workflow that runs on pull requests and your default
branch:

```yaml
- uses: dcramer/frameshift/ci@68a8b5e8bbd439088ef9a044e693c5de9efe7ecd
  with:
    screenshots: path/to/test-output/screenshots
```

On the default branch, it saves the screenshots for the current commit. On a
pull request, it finds the screenshots for the exact commit GitHub tested and
creates the report. It does not rerun your tests.

Frameshift uses `frameshift-baseline-v1` to identify this set. Change
`saved-name` when a browser or screenshot format change means you must start a
new set:

```yaml
- uses: dcramer/frameshift/ci@68a8b5e8bbd439088ef9a044e693c5de9efe7ecd
  with:
    screenshots: path/to/test-output/screenshots
    saved-name: screenshots-v2
    screenshot-retention-days: 60
```

The job must write one complete set of PNG files. A missing file means a removed
screenshot. Do not compare one part of a split test run with a complete saved
set.

## Lower-level Actions

Use the separate save and download Actions only when the combined CI Action
cannot fit your workflow:

```yaml
- uses: dcramer/frameshift/baseline/upload@68a8b5e8bbd439088ef9a044e693c5de9efe7ecd
  with:
    path: path/to/current-screenshots

- uses: dcramer/frameshift/baseline@68a8b5e8bbd439088ef9a044e693c5de9efe7ecd
  id: baseline
  with:
    path: path/to/before
```

Save uses `github.sha` unless you pass `sha`. Download uses `github.token` to ask
GitHub which default-branch commit the pull request tested. It does not need the
full Git history.

Frameshift stops if those screenshots have expired. It waits briefly when the
default-branch job is still saving them. It never chooses screenshots from a
different commit. The selected commit ID is available as
`steps.baseline.outputs.sha`.
