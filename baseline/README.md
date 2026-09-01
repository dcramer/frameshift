# Save and download screenshots

The main [`ci` Action](../ci/action.yml) handles normal screenshot storage. Use
it after your tests in a workflow that runs on pull requests and your default
branch:

```yaml
- uses: dcramer/frameshift/ci@43268de9ab851991f7240217636d475806c15ae2
  with:
    screenshots: path/to/test-output/screenshots
```

On the default branch, it saves the screenshots under the full current Git
commit ID. On a pull request, it downloads the exact set that GitHub tested and
creates the report. It does not rerun your tests.

The default saved name is `frameshift-baseline-v1`. Change `saved-name` when a
browser or screenshot-format change makes old screenshots incompatible:

```yaml
- uses: dcramer/frameshift/ci@43268de9ab851991f7240217636d475806c15ae2
  with:
    screenshots: path/to/test-output/screenshots
    saved-name: screenshots-v2
    screenshot-retention-days: 60
```

The job must write one complete set of PNG files. A missing new path means a
removed screenshot, so do not compare a partial or sharded run with a complete
saved set.

## Lower-level Actions

Use the separate save and download Actions only when the combined CI Action
cannot fit your workflow:

```yaml
- uses: dcramer/frameshift/baseline/upload@43268de9ab851991f7240217636d475806c15ae2
  with:
    path: path/to/current-screenshots

- uses: dcramer/frameshift/baseline@43268de9ab851991f7240217636d475806c15ae2
  id: baseline
  with:
    path: path/to/before
```

Save uses `github.sha` unless you pass `sha`. Download uses `github.token` and
asks GitHub which default-branch commit the pull request was tested against. It
does not need full Git history or stale pull request event data.

Download refuses expired uploads and waits briefly while the default-branch
job is still saving one. It never chooses a nearby set or creates a missing
one. The selected commit ID is available as `steps.baseline.outputs.sha`.
