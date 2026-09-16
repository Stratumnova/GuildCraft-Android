import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket, stepMarket } from '../src/simulation/livingMarket.js';
import { validateState } from '../src/simulation/invariants.js';

test('invalid candidate preserves canonical entities and pauses', () => {
  const before = createMarket({ seed: 25 }).state;
  before.stalls.food.display = -1;
  const result = stepMarket(before, 1);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state.actors, before.actors);
  assert.deepEqual(result.state.stalls, before.stalls);
  assert.equal(result.state.paused, true);
  assert.equal(result.failure.type, 'INVARIANT_FAILURE');
  assert(result.state.events.at(-1).type === 'INVARIANT_FAILURE');
});

test('validator rejects broken references and ledger arithmetic', () => {
  const state = createMarket({ seed: 25 }).state;
  state.actors.mira.workplaceId = 'stall:missing';
  state.ledger.push({ quantity: 2, unitPrice: 5, total: 9, buyerId: 'ada', sellerId: 'mira', stallId: 'food' });
  const result = validateState(state);
  assert.equal(result.ok, false);
  assert(result.violations.some(item => item.code === 'UNKNOWN_WORKPLACE'));
  assert(result.violations.some(item => item.code === 'LEDGER_TOTAL_MISMATCH'));
});
