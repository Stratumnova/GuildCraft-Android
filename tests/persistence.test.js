import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckpointStore } from '../src/adapters/checkpointStore.js';
import { createMarket } from '../src/simulation/livingMarket.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    values
  };
}

test('checkpoint round trip preserves RNG and authoritative travel state', async () => {
  const storage = memoryStorage();
  const store = createCheckpointStore({ storage });
  const state = createMarket({ seed: 25, stream: 77, sessionId: 'persist' }).state;
  const checkpoint = {
    schemaVersion: 1,
    buildFingerprint: 'market-lab-test',
    state: {
      ...state,
      rngState: { state: '1234abcd', increment: '55' },
      actors: {
        ...state.actors,
        mira: {
          ...state.actors.mira,
          locationId: null,
          travel: {
          destinationId: 'stall:food', routeId: 'home:mira->stall:food',
          path: [{ x: 8, y: 8 }, { x: 16, y: 16 }, { x: 24, y: 24 }],
          progress: 0.25, departedAt: 12, expectedArrival: 32
          }
        }
      }
    }
  };

  await store.saveCheckpoint(checkpoint);
  const loaded = await store.loadCheckpoint();

  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.checkpoint, checkpoint);
});

test('checksum mismatch returns recoverable evidence and never exposes executable state', async () => {
  const storage = memoryStorage();
  const store = createCheckpointStore({ storage });
  await store.saveCheckpoint({ schemaVersion: 1, buildFingerprint: 'build-a', state: { gameMinute: 90 } });
  const envelope = JSON.parse(storage.values.get('market-lab:checkpoint:v1'));
  envelope.checksum = '0'.repeat(64);
  storage.setItem('market-lab:checkpoint:v1', JSON.stringify(envelope));

  const loaded = await store.loadCheckpoint();

  assert.deepEqual(Object.keys(loaded).sort(), ['ok', 'reason', 'recoverableExport'].sort());
  assert.equal(loaded.ok, false);
  assert.equal(loaded.reason, 'CHECKSUM_MISMATCH');
  assert.match(loaded.recoverableExport, /"gameMinute":90/);
});
