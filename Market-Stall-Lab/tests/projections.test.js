import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket } from '../src/simulation/livingMarket.js';
import { createTravel } from '../src/simulation/travel.js';
import { projectMarket } from '../src/projections/marketProjection.js';
import { projectTerminal } from '../src/projections/terminalProjection.js';

test('rendered actor coordinates come from authoritative travel', () => {
  const state = createMarket({ seed: 25 }).state;
  state.gameMinute = 110;
  state.actors.mira.travel = createTravel({
    locationId: 'home:mira', destinationId: 'stall:food',
    path: [{ x: 0, y: 0 }, { x: 10, y: 20 }], departureMinute: 100, arrivalMinute: 120
  });
  const actor = projectMarket(state).actors.find(candidate => candidate.id === 'mira');
  assert.deepEqual(actor.position, { x: 5, y: 10, progress: 0.5 });
});

test('terminal projection filters one canonical event stream', () => {
  const state = createMarket({ seed: 25 }).state;
  const events = [
    { type: 'NPC_TRAVEL', actorId: 'mira', gameMinute: 1 },
    { type: 'NPC_WORK', actorId: 'orrin', gameMinute: 2 }
  ];
  const terminal = projectTerminal(state, events, { actorId: 'mira' });
  assert.deepEqual(terminal.events, [events[0]]);
  assert.equal(terminal.actors.length, 6);
  assert.equal(terminal.stalls.length, 3);
});
