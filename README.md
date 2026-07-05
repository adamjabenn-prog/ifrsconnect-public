# IFRS Connect - IFRS 16 Lease Accounting Calculator

[IFRS Connect](https://ifrsconnect.com/ifrs16calculator) is a cloud-based IFRS 16 calculator for finance teams, accountants and auditors who need lease liability schedules, right-of-use asset schedules, depreciation, interest and journal outputs without maintaining complex spreadsheets.

This public repository documents the product surface for IFRS Connect. The proprietary calculation engine and application source code are kept private.

## Try the IFRS 16 calculator

Use the live [IFRS 16 calculator](https://ifrsconnect.com/ifrs16calculator) to enter lease details and generate supported IFRS 16 / AASB 16 lessee outputs. The calculator is free to start with no sign-up required. Excel export and full working-paper outputs are available on Pro plans.

## What it calculates

For supported workflows, IFRS Connect generates:

- Lease liability schedule with opening balance, interest, payments and closing balance
- Right-of-use asset schedule and depreciation by period
- Journal entries for lease liability, interest, payments and depreciation
- CPI / indexation remeasurement outputs
- Scoped lease modification and term-extension workflows
- Rent-free period, lease incentive, initial direct cost and restoration provision inputs
- Audit-ready Excel export on supported plans

## Calculation methodology

The calculator is designed around deterministic, reconciliation-focused logic so the same supported inputs are processed consistently. The public methodology explains the calculation approach, supported workflow limits and review controls:

- [IFRS 16 calculation methodology](https://ifrsconnect.com/methodology)
- [IFRS 16 calculator guide](https://ifrsconnect.com/ifrs-16-calculator)

IFRS Connect is a general-purpose software tool. It does not provide accounting advice, legal advice or a substitute for professional judgement where lease facts fall outside the supported automated scope.

## Working papers and Excel export

For audit and month-end review, IFRS Connect can export structured Excel working papers with liability, ROU asset and journal outputs on supported plans:

- [IFRS 16 working papers](https://ifrsconnect.com/ifrs-16-working-papers)

## Built for

- Finance teams managing lease portfolios under IFRS 16 or AASB 16
- Accountants preparing repeatable lease schedules and month-end journals
- Auditors reviewing lessee calculations and supporting working papers
- Controllers replacing fragile lease accounting spreadsheets with a browser-based workflow

## Repository boundary

This repository is a public product profile and backlink surface for IFRS Connect. It intentionally does not contain the proprietary calculator source code, export engine or private validation suite.

Calculation engine and application code are proprietary.

## Exchange rate data

`fx/ecb-snapshot.json` is a snapshot of the European Central Bank euro foreign-exchange reference rates, used by the calculator's optional presentation-currency (IAS 21) translation feature. Source: European Central Bank (https://www.ecb.europa.eu), freely reusable with attribution; rates are mid-market reference rates. Regenerated daily by a GitHub Action; served over jsDelivr for the app.
