import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicalHash } from '../src/simulation/canonicalize.js';
import { createCheckpointStore } from '../src/adapters/checkpointStore.js';

const fixtureUrl = new URL('../fixtures/seed-25-seven-day-hashes.json', import.meta.url);

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('seed-25 Lab autonomously survives the complete checkpointed acceptance path', async () => {
  assert.equal(fs.existsSync(fixtureUrl), true, 'approve fixtures/seed-25-seven-day-hashes.json before acceptance');
  const baseline = JSON.parse(fs.readFileSync(fixtureUrl, 'utf8'));
  const { createLabController } = await import('../src/app/labController.js');
  const buildInfo = { version: '0.1.0', commit: 'acceptance', fingerprint: baseline.buildFingerprint, builtAt: baseline.builtAt };
  const options = { seed: 25, stream: 77, sessionId: 'seed-25-acceptance', buildInfo };

  const uninterrupted = createLabController(options);
  assert.equal(uninterrupted.snapshot().running, true);
  uninterrupted.runMinutes(10_080);

  const firstRuntime = createLabController(options);
  let travelingActor;
  while (firstRuntime.state.gameMinute < 600 && !travelingActor) {
    firstRuntime.runMinutes(1);
    travelingActor = firstRuntime.marketView().actors.find(actor => actor.traveling);
  }
  assert(travelingActor, 'at least one actor must visibly travel during autonomous startup');
  firstRuntime.selectActor(travelingActor.id);
  firstRuntime.followActor(travelingActor.id);
  assert.equal(firstRuntime.camera.snapshot().followId, travelingActor.id);
  for (const mode of ['split', 'market', 'terminal']) assert.equal(firstRuntime.setMode(mode), mode);
  firstRuntime.runMinutes(4_260 - firstRuntime.state.gameMinute);
  firstRuntime.pause();
  assert.equal(firstRuntime.snapshot().running, false);
  firstRuntime.stepHour();
  assert.equal(firstRuntime.state.gameMinute, 4_320);

  const storage = memoryStorage();
  const checkpointStore = createCheckpointStore({ storage });
  await checkpointStore.saveCheckpoint(firstRuntime.createCheckpoint());
  firstRuntime.destroy();
  const loaded = await checkpointStore.loadCheckpoint();
  assert.equal(loaded.ok, true);
  const resumed = createLabController({ ...options, checkpoint: loaded.checkpoint });
  assert.equal(resumed.state.gameMinute, 4_320, 'reload must not add offline time');
  resumed.resume();
  resumed.runMinutes(5_760);

  const json = JSON.parse(resumed.buildJsonEvidence({ exportedAt: baseline.exportedAt }));
  const text = resumed.buildTextEvidence({ exportedAt: baseline.exportedAt });
  assert.equal(json.checkpoint.buildFingerprint, buildInfo.fingerprint);
  assert.match(text, new RegExp(buildInfo.fingerprint));

  const stateHash = await canonicalHash(resumed.state);
  const eventHash = await canonicalHash(resumed.journal);
  assert.equal(stateHash, await canonicalHash(uninterrupted.state));
  assert.equal(eventHash, await canonicalHash(uninterrupted.journal));
  assert.equal(stateHash, baseline.stateHash);
  assert.equal(eventHash, baseline.eventHash);
  assert.equal(resumed.state.warnings.length, baseline.warningCount);
  assert.equal(resumed.state.ledger.length, baseline.ledgerEntries);
});
