import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket, stepMarket } from '../src/simulation/livingMarket.js';
import { canonicalHash } from '../src/simulation/canonicalize.js';

function run(state, minutes) {
  const result = stepMarket(state, minutes);
  assert.equal(result.ok, true, JSON.stringify(result.failure));
  return result;
}

test('seven-day uninterrupted and checkpoint-resumed runs are identical', async () => {
  const uninterrupted = run(createMarket({ seed: 25, stream: 77, sessionId: 'acceptance' }).state, 10_080);

  const firstLeg = run(createMarket({ seed: 25, stream: 77, sessionId: 'acceptance' }).state, 4_320);
  const checkpoint = JSON.parse(JSON.stringify(firstLeg.state));
  const secondLeg = run(checkpoint, 5_760);
  const resumedEvents = [...firstLeg.events, ...secondLeg.events];

  assert.equal(await canonicalHash(uninterrupted.state), await canonicalHash(secondLeg.state));
  assert.equal(await canonicalHash(uninterrupted.events), await canonicalHash(resumedEvents));
  assert.equal(secondLeg.state.gameMinute, 10_080);
});
