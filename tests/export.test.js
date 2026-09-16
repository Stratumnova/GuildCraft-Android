import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJsonReport, buildTextReport } from '../src/app/reportBuilder.js';
import { saveFile } from '../src/adapters/fileExporter.js';

function fixtureReportContext() {
  return {
    exportedAt: '2026-09-16T12:00:00.000Z',
    build: { fingerprint: 'market-lab-abc123', version: '0.1.0' },
    checkpoint: { buildFingerprint: 'market-lab-abc123', state: { gameMinute: 120 } },
    configuration: { seed: 25, speed: 4 },
    journal: [{ type: 'PURCHASE', minute: 45 }],
    ledger: [{ debit: 4, credit: 4 }],
    marks: [{ minute: 60, note: 'inspect food stall' }],
    warnings: []
  };
}

test('JSON evidence separates checkpoint from evidence streams', () => {
  const report = JSON.parse(buildJsonReport(fixtureReportContext()));
  assert.deepEqual(Object.keys(report).sort(),
    ['build', 'checkpoint', 'configuration', 'exportedAt', 'journal', 'ledger', 'marks', 'warnings'].sort());
  assert.equal(report.build.fingerprint, report.checkpoint.buildFingerprint);
});

test('text evidence is human-readable and identifies the same build', () => {
  const report = buildTextReport(fixtureReportContext());
  assert.match(report, /^MARKET STALL LAB EVIDENCE/m);
  assert.match(report, /Build fingerprint: market-lab-abc123/);
  assert.match(report, /Game minute: 120/);
  assert.match(report, /PURCHASE/);
});

test('saveFile resolves only after the native adapter confirms a real file', async () => {
  const writes = [];
  const result = await saveFile({
    name: 'market-lab-report.json', mimeType: 'application/json', bytes: '{"ok":true}',
    nativeAdapter: { async saveFile(file) { writes.push(file); return { uri: 'file:///reports/market-lab-report.json' }; } }
  });

  assert.equal(writes.length, 1);
  assert.equal(writes[0].name, 'market-lab-report.json');
  assert.deepEqual(result, { ok: true, method: 'native', uri: 'file:///reports/market-lab-report.json' });
});
