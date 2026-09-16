import { LOCATIONS } from './schema.js';

function violation(code, detail) {
  return { code, detail };
}

export function validateState(state) {
  const violations = [];
  if (!Number.isSafeInteger(state.gameMinute) || state.gameMinute < 0) {
    violations.push(violation('INVALID_GAME_TIME', state.gameMinute));
  }
  if (!Number.isSafeInteger(state.eventSequence) || state.eventSequence < 0) {
    violations.push(violation('INVALID_EVENT_SEQUENCE', state.eventSequence));
  }
  for (const actor of Object.values(state.actors ?? {})) {
    if (!LOCATIONS[actor.locationId]) violations.push(violation('UNKNOWN_LOCATION', `${actor.id}:${actor.locationId}`));
    if (actor.workplaceId && !Object.values(state.stalls ?? {}).some(stall => stall.locationId === actor.workplaceId)) {
      violations.push(violation('UNKNOWN_WORKPLACE', `${actor.id}:${actor.workplaceId}`));
    }
    if (!Number.isFinite(actor.currency) || actor.currency < 0) violations.push(violation('INVALID_CURRENCY', actor.id));
    for (const [need, value] of Object.entries(actor.needs ?? {})) {
      if (!Number.isFinite(value) || value < 0 || value > 100) violations.push(violation('INVALID_NEED', `${actor.id}:${need}`));
    }
    for (const [itemId, quantity] of Object.entries(actor.inventory ?? {})) {
      if (!Number.isSafeInteger(quantity) || quantity < 0) violations.push(violation('INVALID_INVENTORY', `${actor.id}:${itemId}`));
    }
    if (actor.travel) {
      if (!LOCATIONS[actor.travel.locationId] || !LOCATIONS[actor.travel.destinationId]) {
        violations.push(violation('INVALID_TRAVEL_ENDPOINT', actor.id));
      }
      if (actor.travel.arrivalMinute <= actor.travel.departureMinute) violations.push(violation('INVALID_TRAVEL_TIME', actor.id));
    }
  }
  for (const stall of Object.values(state.stalls ?? {})) {
    for (const field of ['storage', 'display', 'till', 'price']) {
      if (!Number.isFinite(stall[field]) || stall[field] < 0) violations.push(violation('INVALID_STALL_VALUE', `${stall.id}:${field}`));
    }
    if (!state.actors?.[stall.operatorId]) violations.push(violation('UNKNOWN_OPERATOR', stall.id));
  }
  for (const [index, row] of (state.ledger ?? []).entries()) {
    if (row.total !== row.quantity * row.unitPrice) violations.push(violation('LEDGER_TOTAL_MISMATCH', index));
    if (!state.actors?.[row.buyerId] || !state.actors?.[row.sellerId] || !state.stalls?.[row.stallId]) {
      violations.push(violation('LEDGER_REFERENCE_MISMATCH', index));
    }
  }
  return { ok: violations.length === 0, violations };
}
