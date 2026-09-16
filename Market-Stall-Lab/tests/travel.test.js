import test from 'node:test';
import assert from 'node:assert/strict';
import { createTravel, projectTravel, advanceTravel } from '../src/simulation/travel.js';

test('travel projection interpolates authoritative route progress', () => {
  const travel = createTravel({
    locationId: 'home:mira',
    destinationId: 'stall:food',
    path: [{ x: 0, y: 0 }, { x: 10, y: 20 }],
    departureMinute: 100,
    arrivalMinute: 120
  });
  assert.deepEqual(projectTravel(travel, 110), { x: 5, y: 10, progress: 0.5 });
});

test('arriving commits destination as location and clears travel', () => {
  const actor = {
    locationId: 'home:mira',
    travel: createTravel({
      locationId: 'home:mira', destinationId: 'stall:food',
      path: [{ x: 0, y: 0 }, { x: 10, y: 20 }], departureMinute: 100, arrivalMinute: 120
    })
  };
  assert.deepEqual(advanceTravel(actor, 120), { locationId: 'stall:food', travel: null });
});
