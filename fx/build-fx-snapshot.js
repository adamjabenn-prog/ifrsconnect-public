#!/usr/bin/env node
'use strict';
/* ============================================================================
 * build-fx-snapshot.js — regenerate the hosted ECB rate snapshot.
 *
 * Builds the compact date-keyed artifact the client feed fetches
 * (bubble-plugin/manage-leases/src/fx-feed.js -> createFeedFromUrl).
 *
 * SOURCE: the ECB euro foreign-exchange reference rates, retrieved in bulk from
 * frankfurter.dev (a keyless, CORS-friendly ECB mirror; the runtime feed already
 * uses it as its live fallback). NOTE: the ECB's own eurofxref-hist.csv endpoint
 * was observed serving TRUNCATED data (ending 2010) on multiple clean networks
 * 2026-07-05, so we take the full history from frankfurter instead — same ECB
 * numbers, reliably current. The generator VALIDATES before writing, so a bad or
 * stale fetch fails the job and never overwrites a good snapshot.
 *
 * DESIGNED TO RUN IN CI (GitHub Actions), NOT on anyone's laptop. Node 18+.
 *
 *   node tools/build-fx-snapshot.js                 # write public/fx/ecb-snapshot.json
 *   node tools/build-fx-snapshot.js --out path.json # custom path
 *   node tools/build-fx-snapshot.js --check         # fetch+build+validate, don't write
 *
 * Historical ECB rates are immutable, so an old snapshot is never "wrong"; this
 * refresh only extends the fast-primary coverage to recent dates (the runtime
 * feed falls back to frankfurter/ECB for any date the snapshot lacks).
 * ========================================================================== */
const fs = require('node:fs');
const path = require('node:path');

const HIST_START = '1999-01-04';
const FRANKFURTER = 'https://api.frankfurter.dev/v1/';
// The currencies the app offers (fx-panel.js / disclosure) that the ECB publishes.
// EUR is the base (implicit = 1). ECB does NOT publish some app currencies (e.g.
// AED) — those are skipped here and remain manual-entry in the UI.
const WANTED = ['USD', 'GBP', 'AUD', 'CAD', 'CHF', 'JPY', 'NZD', 'SGD', 'HKD', 'ZAR', 'SEK', 'NOK', 'DKK'];

async function fetchHistory() {
  const today = new Date().toISOString().slice(0, 10);
  const url = FRANKFURTER + HIST_START + '..' + today + '?base=EUR&symbols=' + WANTED.join(',');
  const res = await fetch(url, { headers: { 'user-agent': 'ifrsconnect-fx-snapshot/1.0' } });
  if (!res.ok) throw new Error('frankfurter fetch failed: HTTP ' + res.status);
  const j = await res.json();
  const raw = j && j.rates ? j.rates : {};
  const dates = Object.keys(raw).sort();
  if (!dates.length) throw new Error('frankfurter returned no rates');
  // Which wanted currencies actually appear in the data.
  const present = WANTED.filter((c) => dates.some((d) => raw[d] && raw[d][c] != null));
  const skipped = WANTED.filter((c) => present.indexOf(c) === -1);
  const byDate = new Map();
  for (const iso of dates) {
    const row = {}; let any = false;
    for (const c of present) { const v = raw[iso] && raw[iso][c]; if (v != null && isFinite(v)) { row[c] = Number(v); any = true; } }
    if (any) byDate.set(iso, row);
  }
  return { currencies: present, skipped, byDate, sortedDates: Array.from(byDate.keys()).sort() };
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
      sourceUrl: 'https://api.frankfurter.dev (ECB reference rates)',
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
  const ageDays = (Date.now() - Date.parse(m.lastDate + 'T00:00:00Z')) / 86400000;
  if (ageDays > 10) problems.push('lastDate ' + m.lastDate + ' is ' + Math.round(ageDays) + ' days stale (feed problem?)');
  for (const c of ['USD', 'GBP']) if (m.currencies.indexOf(c) === -1) problems.push('missing core currency ' + c);
  const last = compact.rates[m.lastDate] || [];
  ['USD', 'GBP'].forEach((c) => { const v = last[m.currencies.indexOf(c)]; if (!(v > 0 && isFinite(v))) problems.push('latest ' + c + ' rate not positive-finite'); });
  return problems;
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const outIdx = args.indexOf('--out');
  const outPath = outIdx !== -1 ? args[outIdx + 1] : path.join(__dirname, '..', 'public', 'fx', 'ecb-snapshot.json');

  console.log('[fx-snapshot] fetching ECB history via frankfurter.dev ' + HIST_START + '..today');
  const parsed = await fetchHistory();
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
  console.log('[fx-snapshot] wrote ' + outPath + ' (' + kb + ' KB)');
}

if (require.main === module) {
  main().catch((e) => { console.error('[fx-snapshot] FATAL', e && e.message ? e.message : e); process.exit(1); });
}

module.exports = { fetchHistory, buildCompact, validate, WANTED };
