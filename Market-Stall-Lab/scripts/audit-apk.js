import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REQUIRED = [
  'assets/public/index.html',
  'assets/public/build-info.json',
  'assets/public/simulation/livingMarket.js',
  'assets/public/adapters/fileExporter.js',
  'assets/public/app/bootstrap.js',
  'assets/public/app/reportBuilder.js'
];

const FORBIDDEN = [
  { label: 'trapline/', pattern: /trapline\//i },
  { label: 'portal/', pattern: /portal\//i },
  { label: 'roomHost', pattern: /roomhost/i },
  { label: 'navigator.clipboard', pattern: /navigator\.clipboard/i },
  { label: 'front-facing application ID', pattern: /org\.neocities\.guildcraft(?!\.[a-z0-9_])/i }
];

export function auditApk({ apkPath, fingerprint }) {
  if (!fs.existsSync(apkPath)) throw new Error(`APK not found: ${apkPath}`);
  if (!/^[0-9a-f]{12}$/.test(fingerprint)) throw new Error('expected a 12-character lowercase fingerprint');
  const entries = execFileSync('unzip', ['-Z1', apkPath], { encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean);
  for (const required of REQUIRED) {
    if (!entries.some(entry => entry.endsWith(required))) throw new Error(`missing required APK entry: ${required}`);
  }
  const content = execFileSync('unzip', ['-p', apkPath], { maxBuffer: 256 * 1024 * 1024 }).toString('latin1');
  if (!content.includes(fingerprint)) throw new Error(`missing build fingerprint: ${fingerprint}`);
  if (!content.includes('FileSavePlugin')) {
    throw new Error('missing native Save As bridge');
  }
  for (const forbidden of FORBIDDEN) {
    if (forbidden.pattern.test(`${entries.join('\n')}\n${content}`)) {
      throw new Error(`forbidden content: ${forbidden.label}`);
    }
  }
  return { ok: true, entries: entries.length, fingerprint };
}

function main() {
  const apkPath = process.argv[2];
  const fingerprint = process.argv[3];
  const result = auditApk({ apkPath, fingerprint });
  process.stdout.write(`APK audit passed: ${result.entries} entries, fingerprint ${result.fingerprint}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
