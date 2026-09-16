function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function createTravel({ locationId, destinationId, routeId, path, departureMinute, arrivalMinute }) {
  if (!locationId || !destinationId) throw new Error('travel requires location and destination');
  if (!Array.isArray(path) || path.length < 2) throw new Error('travel path requires at least two points');
  if (!Number.isFinite(departureMinute) || !Number.isFinite(arrivalMinute) || arrivalMinute <= departureMinute) {
    throw new Error('travel arrival must follow departure');
  }
  return {
    locationId,
    destinationId,
    routeId: routeId ?? `${locationId}->${destinationId}`,
    path: path.map(point => ({ x: Number(point.x), y: Number(point.y) })),
    progress: 0,
    departureMinute,
    arrivalMinute
  };
}

export function projectTravel(travel, gameMinute) {
  const progress = clamp01((gameMinute - travel.departureMinute) / (travel.arrivalMinute - travel.departureMinute));
  const scaled = progress * (travel.path.length - 1);
  const index = Math.min(Math.floor(scaled), travel.path.length - 2);
  const local = scaled - index;
  const from = travel.path[index];
  const to = travel.path[index + 1];
  return {
    x: from.x + (to.x - from.x) * local,
    y: from.y + (to.y - from.y) * local,
    progress
  };
}

export function advanceTravel(actor, gameMinute) {
  if (!actor.travel) return { ...actor };
  const projection = projectTravel(actor.travel, gameMinute);
  if (projection.progress >= 1) {
    return { ...actor, locationId: actor.travel.destinationId, travel: null };
  }
  return { ...actor, travel: { ...actor.travel, progress: projection.progress } };
}
