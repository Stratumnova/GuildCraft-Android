export const SCHEMA_VERSION = 'MARKET_LAB_1';

export const LOCATIONS = Object.freeze({
  'home:mira': { x: 8, y: 8 },
  'home:orrin': { x: 50, y: 8 },
  'home:ves': { x: 8, y: 50 },
  'home:ada': { x: 50, y: 50 },
  'home:tomas': { x: 30, y: 54 },
  'home:ren': { x: 54, y: 30 },
  'stall:food': { x: 24, y: 24 },
  'stall:tools': { x: 40, y: 24 },
  'stall:salvage': { x: 32, y: 40 },
  'source:wild': { x: 4, y: 32 }
});

export function routeBetween(fromId, toId) {
  const from = LOCATIONS[fromId];
  const to = LOCATIONS[toId];
  if (!from || !to) throw new Error(`unknown route endpoint ${fromId} -> ${toId}`);
  return [from, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, to];
}
