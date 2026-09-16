import { LOCATIONS } from '../simulation/schema.js';
import { projectTravel } from '../simulation/travel.js';

export function actorPosition(actor, gameMinute) {
  if (actor.travel) return projectTravel(actor.travel, gameMinute);
  const point = LOCATIONS[actor.locationId];
  if (!point) throw new Error(`actor ${actor.id} has unknown location ${actor.locationId}`);
  return { x: point.x, y: point.y, progress: 1 };
}

export function projectMarket(state) {
  return {
    gameMinute: state.gameMinute,
    actors: Object.values(state.actors).map(actor => ({
      id: actor.id,
      intent: actor.intent,
      needs: actor.needs,
      position: actorPosition(actor, state.gameMinute),
      traveling: Boolean(actor.travel)
    })),
    stalls: Object.values(state.stalls).map(stall => ({
      ...stall,
      position: { ...LOCATIONS[stall.locationId] }
    }))
  };
}
