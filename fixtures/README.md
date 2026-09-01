# Sample reports

Each folder contains one complete report. The website serves these files only
while developing. Production builds do not include them, except for the public
sample copied to `/sample/`.

`mixed` is built by the same code users run. Its changed screenshot is an
original travel website with a new notice, changed wording, and a changed
number. It also includes one new page, one removed page, and one matching page.
Do not edit its `report.json` or PNG files by hand.

Run `pnpm fixture:generate` after changing how reports are built. Run
`pnpm fixtures:check` to check every report and confirm that every listed PNG
exists and no extra PNG files are present.
