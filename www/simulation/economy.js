import { createTravel, advanceTravel } from './travel.js';
import { routeBetween } from './schema.js';

function inventoryAdd(actor, itemId, quantity) {
  actor.inventory[itemId] = (actor.inventory[itemId] ?? 0) + quantity;
}

function setIntent(actor, type, reason, state, emit) {
  if (actor.intent.type === type && actor.intent.reason === reason) return;
  actor.intent = { type, reason, formedAt: state.gameMinute };
  emit('NPC_INTENT', { actorId: actor.id, intent: type, reason });
}

function beginTravel(actor, destinationId, state, emit, reason) {
  if (actor.locationId === destinationId || actor.travel) return;
  const path = routeBetween(actor.locationId, destinationId);
  const distance = path.slice(1).reduce((sum, point, index) => {
    const previous = path[index];
    return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
  const duration = Math.max(5, Math.ceil(distance / 2));
  actor.travel = createTravel({
    locationId: actor.locationId,
    destinationId,
    path,
    departureMinute: state.gameMinute,
    arrivalMinute: state.gameMinute + duration
  });
  emit('NPC_TRAVEL', { actorId: actor.id, fromId: actor.locationId, destinationId, routeId: actor.travel.routeId, reason });
}

function processVendor(actor, stall, state, emit) {
  const hour = Math.floor((state.gameMinute % 1440) / 60);
  const working = hour >= 8 && hour < 18;
  stall.open = working && actor.locationId === stall.locationId && !actor.travel;

  if (!working) {
    if (!actor.travel && actor.locationId !== actor.homeId) {
      setIntent(actor, 'RETURN_HOME', 'SHIFT_ENDED', state, emit);
      beginTravel(actor, actor.homeId, state, emit, 'SHIFT_ENDED');
    } else if (!actor.travel) setIntent(actor, 'REST', 'OFF_SHIFT', state, emit);
    return;
  }

  if (actor.locationId === 'source:wild' && !actor.travel) {
    inventoryAdd(actor, stall.itemId, 8);
    emit('NPC_SOURCE', { actorId: actor.id, stallId: stall.id, itemId: stall.itemId, quantity: 8 });
    setIntent(actor, 'RETURN_STOCK', 'SOURCE_COMPLETE', state, emit);
    beginTravel(actor, stall.locationId, state, emit, 'SOURCE_COMPLETE');
    return;
  }

  const carried = actor.inventory[stall.itemId] ?? 0;
  if (actor.locationId === stall.locationId && !actor.travel && carried > 0) {
    stall.storage += carried;
    actor.inventory[stall.itemId] = 0;
    emit('STOCK_TRANSFER', { actorId: actor.id, stallId: stall.id, itemId: stall.itemId, quantity: carried });
  }

  if (actor.locationId !== stall.locationId && !actor.travel) {
    setIntent(actor, 'WORK', 'SCHEDULED_STALL_SHIFT', state, emit);
    beginTravel(actor, stall.locationId, state, emit, 'SCHEDULED_STALL_SHIFT');
    return;
  }
  if (actor.travel) return;

  if (stall.storage < 5) {
    setIntent(actor, 'SOURCE', 'STORAGE_BELOW_TARGET', state, emit);
    stall.open = false;
    beginTravel(actor, 'source:wild', state, emit, 'STORAGE_BELOW_TARGET');
    return;
  }
  if (stall.display < 3 && stall.storage > 0) {
    const quantity = Math.min(4, stall.storage);
    stall.storage -= quantity;
    stall.display += quantity;
    emit('RESTOCK_DISPLAY', { actorId: actor.id, stallId: stall.id, itemId: stall.itemId, quantity });
  }
  setIntent(actor, 'WORK', 'STAFFING_STALL', state, emit);
  emit('NPC_WORK', { actorId: actor.id, stallId: stall.id });
}

function processCustomer(actor, state, emit) {
  if (actor.travel) return;
  const hour = Math.floor((state.gameMinute % 1440) / 60);
  if (hour >= 20 || hour < 6) {
    if (actor.locationId !== actor.homeId) {
      setIntent(actor, 'REST', 'NIGHT_REST', state, emit);
      beginTravel(actor, actor.homeId, state, emit, 'NIGHT_REST');
    } else setIntent(actor, 'REST', 'NIGHT_REST', state, emit);
    return;
  }
  if (actor.needs.hunger <= 55) return;
  const stall = state.stalls.food;
  if (actor.locationId !== stall.locationId) {
    setIntent(actor, 'BUY_FOOD', 'HUNGER_PRESSURE', state, emit);
    beginTravel(actor, stall.locationId, state, emit, 'HUNGER_PRESSURE');
    return;
  }
  if (!stall.open || stall.display <= 0 || actor.currency < stall.price) {
    const reason = !stall.open ? 'STALL_CLOSED' : stall.display <= 0 ? 'OUT_OF_STOCK' : 'INSUFFICIENT_FUNDS';
    emit('PURCHASE_FAILED', { actorId: actor.id, stallId: stall.id, itemId: stall.itemId, reason, wallet: actor.currency, price: stall.price });
    return;
  }
  actor.currency -= stall.price;
  stall.till += stall.price;
  stall.display -= 1;
  const transaction = {
    id: `tx-${state.ledger.length + 1}`,
    type: 'STALL_SALE',
    stallId: stall.id,
    itemId: stall.itemId,
    quantity: 1,
    unitPrice: stall.price,
    total: stall.price,
    sellerId: stall.operatorId,
    buyerId: actor.id,
    gameMinute: state.gameMinute
  };
  state.ledger.push(transaction);
  emit('NPC_PURCHASE', transaction);
  inventoryAdd(actor, stall.itemId, 1);
  actor.inventory[stall.itemId] -= 1;
  actor.needs.hunger = Math.max(0, actor.needs.hunger - 55);
  emit('NPC_CONSUME', { actorId: actor.id, itemId: stall.itemId, need: 'hunger' });
}

export function applyEconomyMinute(state, rng, emit) {
  state.gameMinute += 1;
  for (const actor of Object.values(state.actors)) Object.assign(actor, advanceTravel(actor, state.gameMinute));
  if (state.gameMinute % 60 === 0) {
    for (const actor of Object.values(state.actors)) {
      actor.needs.hunger = Math.min(100, actor.needs.hunger + 3);
      actor.needs.thirst = Math.min(100, actor.needs.thirst + 2);
      actor.needs.fatigue = Math.min(100, actor.needs.fatigue + 2);
    }
  }
  for (const actor of Object.values(state.actors)) {
    const stall = Object.values(state.stalls).find(candidate => candidate.operatorId === actor.id);
    if (stall) processVendor(actor, stall, state, emit);
    else processCustomer(actor, state, emit);
  }
  if (state.gameMinute % 60 === 0) {
    for (const stall of Object.values(state.stalls)) {
      if (stall.open && stall.display > 0 && rng.nextFloat() < 0.35) {
        stall.display -= 1;
        stall.till += stall.price;
        emit('AMBIENT_SALE', { stallId: stall.id, itemId: stall.itemId, quantity: 1, unitPrice: stall.price, total: stall.price });
      }
    }
  }
  for (const stall of Object.values(state.stalls)) {
    stall.pressure = stall.display < 2 ? 'DISPLAY_LOW' : stall.storage < 5 ? 'STORAGE_LOW' : 'OK';
  }
}
