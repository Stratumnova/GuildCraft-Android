import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateWebBuild } from '../scripts/build-web.js';
import { buildJsonReport, buildTextReport } from '../src/app/reportBuilder.js';

test('one generated fingerprint binds UI, checkpoint, reports, and web package', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'market-lab-build-'));
  const sourceDir = path.join(root, 'src');
  const outputDir = path.join(root, 'www');
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'index.html'), '<main>Market Stall Lab</main>');

  const build = await generateWebBuild({
    sourceDir,
    outputDir,
    version: '0.1.0',
    commit: '0123456789abcdef',
    builtAt: '2026-09-16T12:00:00.000Z'
  });
  const uiModule = await import(`${pathToFileURL(path.join(sourceDir, 'generated/buildInfo.js')).href}?t=${Date.now()}`);
  const packaged = JSON.parse(fs.readFileSync(path.join(outputDir, 'build-info.json'), 'utf8'));
  const checkpoint = { buildFingerprint: build.fingerprint, state: { gameMinute: 60 } };
  const context = { build, checkpoint, exportedAt: '2026-09-16T13:00:00.000Z' };
  const json = JSON.parse(buildJsonReport(context));
  const text = buildTextReport(context);

  assert.match(build.fingerprint, /^[0-9a-f]{12}$/);
  assert.equal(uiModule.BUILD_INFO.fingerprint, build.fingerprint);
  assert.equal(packaged.fingerprint, build.fingerprint);
  assert.equal(checkpoint.buildFingerprint, build.fingerprint);
  assert.equal(json.build.fingerprint, build.fingerprint);
  assert.match(text, new RegExp(`Build fingerprint: ${build.fingerprint}`));
  assert.equal(fs.existsSync(path.join(outputDir, 'index.html')), true);
});
