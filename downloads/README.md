# Downloads

Files here are served directly to visitors of [ifrsconnect.com](https://ifrsconnect.com). They are
public on purpose. Treat anything in this folder as published.

## IFRS-Connect-Example-Audit-Pack.xlsx

The full audit pack the calculator produces, generated from a worked example so anyone can see
exactly what they get before signing up for anything.

The lease it models: a five year head office lease, 1 January 2026 to 31 December 2030, £12,000
per month in arrears, 6.00% discount rate, two rent free months from commencement, £3,500 of
initial direct costs, and three CPI remeasurements (indexes 104, 107.2 and 110.5).

21 sheets, including the liability and right of use schedules, an interest walkthrough, a
depreciation walkthrough, journals, per modification reconciliations, a control register and an
exceptions sheet.

Every figure comes from the same deterministic engine that runs on the site. Nothing in it is
typed by hand.

### Keeping it current

Regenerate with `node tools/generate-example-audit-pack.js` in the main repository, then copy the
result here. **Do not let it drift**: this workbook was found five weeks stale in July 2026, built
by an engine that had since had figure affecting corrections. A published example carrying
superseded figures is worse than no example, because a reader has no way to tell.

`npm run verify:live-assets` checks that whatever the site links to actually downloads.
