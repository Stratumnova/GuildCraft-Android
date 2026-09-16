import test from 'node:test';
import assert from 'node:assert/strict';
import { createAndroidLifecycle } from '../src/adapters/androidLifecycle.js';

function appEvents() {
  const handlers = new Map();
  return {
    addListener(name, handler) { handlers.set(name, handler); return { remove() { handlers.delete(name); } }; },
    async emit(name, value) { return handlers.get(name)?.(value); }
  };
}

test('background saves once and resume restores without offline advancement', async () => {
  const app = appEvents();
  const saves = [];
  const applied = [];
  let state = { gameMinute: 345 };
  const lifecycle = createAndroidLifecycle({
    app,
    getCheckpoint: () => ({ buildFingerprint: 'build-a', state }),
    saveCheckpoint: async checkpoint => saves.push(checkpoint),
    loadCheckpoint: async () => ({ ok: true, checkpoint: { buildFingerprint: 'build-a', state: { gameMinute: 345 } } }),
    applyCheckpoint: checkpoint => { applied.push(checkpoint); state = checkpoint.state; },
    ui: { closeDialog: () => false, closeTerminal: () => false },
    exitApp: () => {}
  });
  await lifecycle.start();

  await app.emit('appStateChange', { isActive: false });
  await app.emit('appStateChange', { isActive: false });
  await app.emit('appStateChange', { isActive: true });

  assert.equal(saves.length, 1);
  assert.equal(applied.length, 1);
  assert.equal(state.gameMinute, 345);
});

test('Android Back closes dialog then terminal before double-back exit', async () => {
  const app = appEvents();
  const layers = ['dialog', 'terminal'];
  let exits = 0;
  let now = 1_000;
  const lifecycle = createAndroidLifecycle({
    app,
    getCheckpoint: () => ({}), saveCheckpoint: async () => {}, loadCheckpoint: async () => ({ ok: false }),
    applyCheckpoint: () => {},
    ui: {
      closeDialog: () => layers[0] === 'dialog' ? Boolean(layers.shift()) : false,
      closeTerminal: () => layers[0] === 'terminal' ? Boolean(layers.shift()) : false
    },
    exitApp: () => { exits += 1; }, now: () => now, backWindowMs: 1_500
  });
  await lifecycle.start();

  await app.emit('backButton');
  await app.emit('backButton');
  await app.emit('backButton');
  now += 1_000;
  await app.emit('backButton');

  assert.deepEqual(layers, []);
  assert.equal(exits, 1);
});
