import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutController } from '../src/ui/layout.js';

test('display modes change presentation without replacing simulation', () => {
  const simulation = { id: 'one-authority' };
  const root = { dataset: {} };
  const layout = createLayoutController({ root, simulation });
  for (const mode of ['split', 'terminal', 'market', 'split']) layout.setMode(mode);
  assert.equal(layout.simulation, simulation);
  assert.equal(root.dataset.mode, 'split');
});
