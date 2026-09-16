import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { auditApk } from '../scripts/audit-apk.js';

function fixtureApk({ forbidden = false, nativeFileSave = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'market-lab-apk-'));
  const publicDir = path.join(root, 'assets/public');
  fs.mkdirSync(path.join(publicDir, 'simulation'), { recursive: true });
  fs.mkdirSync(path.join(publicDir, 'adapters'), { recursive: true });
  fs.mkdirSync(path.join(publicDir, 'app'), { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'index.html'), '<main>Market Stall Lab</main>');
  fs.writeFileSync(path.join(publicDir, 'build-info.json'), JSON.stringify({ fingerprint: 'a1b2c3d4e5f6' }));
  fs.writeFileSync(path.join(publicDir, 'simulation/livingMarket.js'), 'export function stepMarket() {}');
  fs.writeFileSync(path.join(publicDir, 'adapters/fileExporter.js'), 'export function saveFile() {}');
  fs.writeFileSync(path.join(publicDir, 'app/reportBuilder.js'), 'export function buildJsonReport() {}');
  fs.writeFileSync(path.join(publicDir, 'app/bootstrap.js'), 'const nativePlugin = "FileSave";');
  fs.writeFileSync(path.join(root, 'classes.dex'), nativeFileSave ? 'FileSavePlugin saveFile' : 'no native saver');
  if (forbidden) fs.writeFileSync(path.join(publicDir, 'legacy.js'), 'const route = "portal/index.html";');
  const apkPath = path.join(root, 'fixture.apk');
  execFileSync('zip', ['-q', '-r', apkPath, 'assets', 'classes.dex'], { cwd: root });
  return apkPath;
}

test('APK audit accepts an autonomous Lab package with real export modules', () => {
  const result = auditApk({ apkPath: fixtureApk(), fingerprint: 'a1b2c3d4e5f6' });
  assert.equal(result.ok, true);
  assert(result.entries >= 5);
});

test('APK audit rejects Portal-coupled content even when Lab files exist', () => {
  assert.throws(
    () => auditApk({ apkPath: fixtureApk({ forbidden: true }), fingerprint: 'a1b2c3d4e5f6' }),
    /forbidden content: portal\//i
  );
});

test('APK audit rejects a build that cannot open Android Save As', () => {
  assert.throws(
    () => auditApk({ apkPath: fixtureApk({ nativeFileSave: false }), fingerprint: 'a1b2c3d4e5f6' }),
    /missing native Save As bridge/i
  );
});
