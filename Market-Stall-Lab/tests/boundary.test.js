import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('lab source excludes front-facing dependencies and clipboard transfer', () => {
  const root = new URL('../src/', import.meta.url);
  assert.equal(fs.existsSync(root), true, 'src/ must exist');
  const files = fs.readdirSync(root, { recursive: true })
    .filter(name => /\.(js|html|css)$/.test(name));
  assert(files.length > 0, 'source files must exist');
  const source = files
    .map(name => fs.readFileSync(new URL(name, root), 'utf8'))
    .join('\n');
  for (const forbidden of ['trapline/', 'portal/', 'roomHost', 'navigator.clipboard', 'playerTransfer']) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});

test('capacitor identity is dedicated to the vPNG1 lab branch', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
  assert.equal(config.appId, 'org.neocities.guildcraft.marketlab.vpng1');
  assert.equal(config.appName, 'Market Stall Lab vPNG1');
  assert.equal(config.webDir, 'www');
});
