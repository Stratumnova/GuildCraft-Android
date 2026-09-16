import { createPcg32 } from './rng.js';
import { SCHEMA_VERSION } from './schema.js';
import { applyEconomyMinute } from './economy.js';
import { validateState } from './invariants.js';

export function createMarket({ seed = 25, stream = 77, sessionId = `seed-${seed}` } = {}) {
  const rng = createPcg32({ seed: BigInt(seed), stream: BigInt(stream) });
  const actors = Object.fromEntries([
    ['mira', 'stall:food', 34], ['orrin', 'stall:tools', 28], ['ves', 'stall:salvage', 18],
    ['ada', null, 22], ['tomas', null, 3], ['ren', null, 40]
  ].map(([id, workplaceId, currency], index) => [id, {
    id,
    homeId: `home:${id}`,
    workplaceId,
    locationId: `home:${id}`,
    travel: null,
    currency,
    inventory: {},
    needs: { hunger: 20 + index * 8, thirst: 15 + index * 5, fatigue: 10, safety: 5 },
    intent: { type: 'REST', reason: 'SIMULATION_START', formedAt: 0 }
  }]));
  const stalls = {
    food: { id: 'food', locationId: 'stall:food', operatorId: 'mira', itemId: 'ration', price: 5, storage: 14, display: 6, till: 20, open: false, pressure: 'OK' },
    tools: { id: 'tools', locationId: 'stall:tools', operatorId: 'orrin', itemId: 'field_tool', price: 9, storage: 10, display: 5, till: 25, open: false, pressure: 'OK' },
    salvage: { id: 'salvage', locationId: 'stall:salvage', operatorId: 'ves', itemId: 'scrap', price: 4, storage: 16, display: 6, till: 15, open: false, pressure: 'OK' }
  };
  return {
    state: {
      schemaVersion: SCHEMA_VERSION,
      sessionId,
      seed,
      rngState: rng.serialize(),
      gameMinute: 0,
      actors,
      stalls,
      ledger: [],
      events: [],
      eventSequence: 0,
      warnings: [],
      marks: [],
      paused: false
    },
    events: []
  };
}

function rejectedState(lastValid, violations) {
  const state = structuredClone(lastValid);
  state.paused = true;
  const failure = { type: 'INVARIANT_FAILURE', gameMinute: state.gameMinute, violations };
  state.eventSequence += 1;
  state.events.push({ ...failure, eventId: `evt-${state.eventSequence}` });
  state.warnings.push(failure);
  return { ok: false, state, events: [state.events.at(-1)], failure };
}

export function stepMarket(input, minutes = 1) {
  if (!Number.isSafeInteger(minutes) || minutes < 0) throw new RangeError('minutes must be a nonnegative integer');
  const initialValidation = validateState(input);
  if (!initialValidation.ok) return rejectedState(input, initialValidation.violations);
  let state = structuredClone(input);
  const emitted = [];
  for (let minute = 0; minute < minutes; minute += 1) {
    const candidate = structuredClone(state);
    const rng = createPcg32(candidate.rngState);
    const stepEvents = [];
    const emit = (type, data = {}) => {
      candidate.eventSequence += 1;
      const event = { ...data, eventId: `evt-${candidate.eventSequence}`, gameMinute: candidate.gameMinute, type };
      candidate.events.push(event);
      stepEvents.push(event);
    };
    applyEconomyMinute(candidate, rng, emit);
    candidate.rngState = rng.serialize();
    const validation = validateState(candidate);
    if (!validation.ok) return rejectedState(state, validation.violations);
    state = candidate;
    emitted.push(...stepEvents);
  }
  return { ok: true, state, events: emitted, failure: null };
}
