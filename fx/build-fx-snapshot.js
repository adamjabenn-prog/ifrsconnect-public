#!/usr/bin/env node
'use strict';
/* ============================================================================
 * build-fx-snapshot.js — regenerate the hosted ECB rate snapshot.
 *
 * Fetches the ECB euro foreign-exchange reference rates (full history CSV),
 * builds the compact date-keyed artifact the client feed fetches
 * (bubble-plugin/manage-leases/src/fx-feed.js -> createFeedFromUrl), and writes
 * it to public/fx/ecb-snapshot.json.
 *
 * DESIGNED TO RUN IN CI (GitHub Actions), NOT on anyone's laptop — see
 * .github/workflows/fx-snapshot-refresh.yml. Node 18+ (global fetch).
 *
 *   node tools/build-fx-snapshot.js                 # write public/fx/ecb-snapshot.json
 *   node tools/build-fx-snapshot.js --out path.json # custom path
 *   node tools/build-fx-snapshot.js --check         # fetch+build+validate, DON'T write (CI dry-run)
 *
 * Historical ECB rates are immutable, so an old snapshot is never "wrong"; this
 * refresh only extends the fast-primary coverage to recent dates (the runtime
 * feed already falls back to frankfurter.dev / ECB for any date the snapshot
 * lacks, so the app never depends on this job having run).
 * ========================================================================== */
const fs = require('node:fs');
const path = require('node:path');

const ECB_CSV_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.csv';
// The currencies the app offers (fx-panel.js / disclosure) that the ECB publishes.
// EUR is the base (implicit = 1). ECB does NOT publish some app currencies (e.g.
// AED) — those are skipped here and remain manual-entry in the UI.
const WANTED = ['USD', 'GBP', 'AUD', 'CAD', 'CHF', 'JPY', 'NZD', 'SGD', 'HKD', 'ZAR', 'SEK', 'NOK', 'DKK'];

function parseEcbCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) throw new Error('empty ECB CSV');
  const header = lines[0].split(',').map((s) => s.trim());
  const dateIdx = header.indexOf('Date');
  if (dateIdx === -1) throw new Error('no Date column in ECB CSV header');
  // Tolerant: keep only the wanted currencies actually present in the header.
  const present = WANTED.filter((c) => header.indexOf(c) !== -1);
  const skipped = WANTED.filter((c) => header.indexOf(c) === -1);
  const colIdx = {};
  present.forEach((c) => { colIdx[c] = header.indexOf(c); });
  const byDate = new Map();
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r].split(',');
    const iso = (cells[dateIdx] || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    const row = {};
    let anyValid = false;
    for (const c of present) {
      const raw = (cells[colIdx[c]] || '').trim();
      if (raw && raw !== 'N/A') { row[c] = Number(raw); anyValid = true; }
    }
    if (anyValid) byDate.set(iso, row);
  }
  const sortedDates = Array.from(byDate.keys()).sort();
  return { currencies: present, skipped, byDate, sortedDates };
}

function buildCompact(parsed) {
  const ccys = parsed.currencies;
  const rates = {};
  for (const iso of parsed.sortedDates) {
    const row = parsed.byDate.get(iso);
    rates[iso] = ccys.map((c) => (row[c] == null ? null : row[c]));
  }
  return {
    meta: {
      source: 'ECB euro foreign exchange reference rates',
      sourceUrl: ECB_CSV_URL,
      license: 'ECB content is freely reusable with attribution (cite ECB as source, note it is available free of charge online, note modifications). https://www.ecb.europa.eu/services/disclaimer/html/index.en.html',
      base: 'EUR',
      currencies: ccys,
      note: 'value = units of currency per 1 EUR; cross-rate(base,quote)=E_quote/E_base',
      rows: parsed.sortedDates.length,
      firstDate: parsed.sortedDates[0],
      lastDate: parsed.sortedDates[parsed.sortedDates.length - 1],
      snapshotDate: parsed.sortedDates[parsed.sortedDates.length - 1],
      generatedAtUtc: new Date().toISOString(),
    },
    rates,
  };
}

function validate(compact) {
  const m = compact.meta;
  const problems = [];
  if (m.rows < 5000) problems.push('too few rows (' + m.rows + '); expected the full ECB history (>5000)');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.lastDate || '')) problems.push('bad lastDate ' + m.lastDate);
  // The ECB publishes business days; the latest row should be within ~10 days of now.
  const ageDays = (Date.now() - Date.parse(m.lastDate + 'T00:00:00Z')) / 86400000;
  if (ageDays > 10) problems.push('lastDate ' + m.lastDate + ' is ' + Math.round(ageDays) + ' days stale (ECB feed problem?)');
  for (const c of ['USD', 'GBP']) if (m.currencies.indexOf(c) === -1) problems.push('missing core currency ' + c);
  // Spot-check the latest row has finite values for the core currencies.
  const last = compact.rates[m.lastDate] || [];
  ['USD', 'GBP'].forEach((c) => { const v = last[m.currencies.indexOf(c)]; if (!(v > 0 && isFinite(v))) problems.push('latest ' + c + ' rate not positive-finite'); });
  return problems;
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const outIdx = args.indexOf('--out');
  const outPath = outIdx !== -1 ? args[outIdx + 1] : path.join(__dirname, '..', 'public', 'fx', 'ecb-snapshot.json');

  console.log('[fx-snapshot] fetching ' + ECB_CSV_URL);
  const res = await fetch(ECB_CSV_URL, { headers: { 'user-agent': 'ifrsconnect-fx-snapshot/1.0' } });
  if (!res.ok) throw new Error('ECB fetch failed: HTTP ' + res.status);
  const csv = await res.text();
  const parsed = parseEcbCsv(csv);
  const compact = buildCompact(parsed);
  const problems = validate(compact);
  console.log('[fx-snapshot] rows=' + compact.meta.rows + ' currencies=' + compact.meta.currencies.join(',')
    + (parsed.skipped.length ? ' (skipped, not in ECB: ' + parsed.skipped.join(',') + ')' : '')
    + ' firstDate=' + compact.meta.firstDate + ' lastDate=' + compact.meta.lastDate);
  if (problems.length) { console.error('[fx-snapshot] VALIDATION FAILED:\n  - ' + problems.join('\n  - ')); process.exit(1); }

  if (checkOnly) { console.log('[fx-snapshot] --check OK (not written)'); return; }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(compact));
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log('[fx-snapshot] wrote ' + path.relative(path.join(__dirname, '..'), outPath) + ' (' + kb + ' KB)');
}

if (require.main === module) {
  main().catch((e) => { console.error('[fx-snapshot] FATAL', e && e.message ? e.message : e); process.exit(1); });
}

module.exports = { parseEcbCsv, buildCompact, validate, WANTED, ECB_CSV_URL };
