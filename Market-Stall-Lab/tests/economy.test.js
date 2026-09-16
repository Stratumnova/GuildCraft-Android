import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket, stepMarket } from '../src/simulation/livingMarket.js';

function readyPurchase() {
  const state = createMarket({ seed: 25 }).state;
  state.gameMinute = 10 * 60;
  state.actors.ada.locationId = 'stall:food';
  state.actors.ada.needs.hunger = 70;
  state.actors.mira.locationId = 'stall:food';
  state.stalls.food.open = true;
  return state;
}

test('purchase updates one canonical actor, stall, ledger, and event stream', () => {
  const before = readyPurchase();
  const result = stepMarket(before, 1);
  assert.equal(result.ok, true);
  assert.equal(result.state.actors.ada.currency, before.actors.ada.currency - 5);
  assert.equal(result.state.stalls.food.display, before.stalls.food.display - 1);
  assert.equal(result.state.stalls.food.till, before.stalls.food.till + 5);
  assert.equal(result.state.actors.ada.needs.hunger, 15);
  assert.equal(result.state.ledger.at(-1).type, 'STALL_SALE');
  assert(result.events.some(event => event.type === 'NPC_PURCHASE'));
  assert(result.events.some(event => event.type === 'NPC_CONSUME'));
});

test('unaffordable purchase records a reason without changing stock', () => {
  const before = readyPurchase();
  before.actors.ada.currency = 0;
  const result = stepMarket(before, 1);
  assert.equal(result.ok, true);
  assert.equal(result.state.stalls.food.display, before.stalls.food.display);
  assert(result.events.some(event => event.type === 'PURCHASE_FAILED' && event.reason === 'INSUFFICIENT_FUNDS'));
});
