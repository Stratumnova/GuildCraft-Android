import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from '../src/app/scheduler.js';

function fixtureScheduler() {
  const deltas = [];
  let state = { gameMinute: 0, paused: false };
  const scheduler = createScheduler({
    getState: () => state,
    commit: next => { state = next; },
    step: (current, delta) => {
      deltas.push(delta);
      return { ok: true, state: { ...current, gameMinute: current.gameMinute + delta }, events: [] };
    },
    baseStepsPerSecond: 2,
    maxStepsPerFrame: 20,
    requestFrame: () => 0
  });
  return { scheduler, deltas, getState: () => state };
}

test('speed changes fixed-step count, never delta size', () => {
  const { scheduler, deltas } = fixtureScheduler();
  scheduler.setSpeed(4);
  scheduler.frame(0);
  scheduler.frame(1000);
  assert.equal(deltas.length, 8);
  assert(deltas.every(delta => delta === 1));
});

test('stepHour advances exactly sixty fixed steps while paused', () => {
  const { scheduler, deltas, getState } = fixtureScheduler();
  scheduler.pause();
  scheduler.stepHour();
  assert.deepEqual(deltas, Array(60).fill(1));
  assert.equal(getState().gameMinute, 60);
  assert.equal(scheduler.snapshot().running, false);
});

test('failed step pauses without committing rejected candidate', () => {
  let state = { gameMinute: 5, paused: false };
  const scheduler = createScheduler({
    getState: () => state,
    commit: next => { state = next; },
    step: current => ({ ok: false, state: { ...current, paused: true }, events: [], failure: { type: 'INVARIANT_FAILURE' } }),
    requestFrame: () => 0
  });
  scheduler.frame(0);
  scheduler.frame(1000);
  assert.equal(state.gameMinute, 5);
  assert.equal(state.paused, true);
  assert.equal(scheduler.snapshot().running, false);
});
