/**
 * Cibola district runtime projection.
 *
 * This is deliberately independent from the market economy. It supplies a
 * continuous 24x24 world split into nine 8x8 mobile sectors, while the
 * existing market state remains authoritative for money, inventory, and
 * transactions.
 */
export const DISTRICT_SIZE = 24;
export const SECTOR_SIZE = 8;
export const SECTOR_COUNT = 3;

export const CANVAS_SPECS = Object.freeze({
  ground: Object.freeze({ width: 128, height: 128, anchor: Object.freeze([64, 124]) }),
  structure: Object.freeze({ width: 192, height: 192, anchor: Object.freeze([96, 188]) }),
  npc: Object.freeze({ width: 128, height: 192, anchor: Object.freeze([64, 188]) })
});

export const ACTIONS = Object.freeze(['idle', 'talk', 'work', 'use']);
export const DIRECTIONS = Object.freeze(['left', 'right', 'down']);

const ZONE_CLASSES = Object.freeze({
  lower: Object.freeze({ name: 'lower-tier', quality: 'rough', sectors: ['0,2', '1,2', '2,2'] }),
  middle: Object.freeze({ name: 'middle-overlap', quality: 'mixed', sectors: ['0,1', '1,1', '2,1', '1,2'] }),
  upper: Object.freeze({ name: 'upper-tier', quality: 'sturdy', sectors: ['0,0', '1,0', '2,0'] })
});

const ROLE_DEFS = Object.freeze([
  ['scavenger', 'scavenger', 'lower'], ['water_runner', 'water runner', 'lower'],
  ['sorter', 'sorter', 'lower'], ['fiber_picker', 'fiber picker', 'lower'],
  ['scrap_picker', 'scrap picker', 'lower'], ['cook', 'cook', 'middle'],
  ['blacksmith', 'blacksmith', 'middle'], ['leatherworker', 'leatherworker', 'middle'],
  ['toolwright', 'toolwright', 'middle'], ['smelter', 'smelter', 'middle'],
  ['courier', 'courier', 'middle'], ['lookout', 'lookout', 'upper'],
  ['fixer', 'fixer', 'upper'], ['trader', 'trader', 'upper'], ['hauler', 'hauler', 'upper']
]);

const LEGACY_DEFS = Object.freeze([
  ['mira', 'food operator', 'middle'], ['orrin', 'tools operator', 'middle'],
  ['ves', 'salvage operator', 'lower'], ['ada', 'water keeper', 'upper'],
  ['tomas', 'runner', 'lower'], ['ren', 'market watch', 'upper']
]);

const STALLS = Object.freeze([
  ['food', 'market_stall_food', 'crafting_station_food', 5, 17],
  ['blacksmith', 'market_stall_blacksmith', 'crafting_station_blacksmith', 13, 17],
  ['leatherworks', 'market_stall_leatherworks', 'crafting_station_leatherworks', 5, 13],
  ['tools_weapons', 'market_stall_tools_weapons', 'crafting_station_tools_weapons', 13, 13],
  ['resources', 'market_stall_resources', 'crafting_station_resources', 9, 9]
]);

function sectorId(x, y) { return `${x},${y}`; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function phaseFor(index, gameMinute) {
  const cycle = (gameMinute + index * 17) % 96;
  if (cycle < 12) return 'talk';
  if (cycle < 72) return 'work';
  if (cycle < 84) return 'use';
  return 'idle';
}

function directionFor(index, gameMinute) {
  return DIRECTIONS[Math.floor((gameMinute + index * 11) / 8) % DIRECTIONS.length];
}

function frameFor(action, gameMinute, index) {
  const counts = { idle: 2, talk: 4, work: 3, use: 3 };
  return Math.floor((gameMinute + index * 3) / 2) % counts[action];
}

function actorPosition(index, role, gameMinute) {
  const baseX = 2 + (index % 5) * 4;
  const baseY = role === 'lower' ? 19 : role === 'middle' ? 13 : 5;
  const travel = ((gameMinute + index * 19) % 48) / 48;
  const x = baseX + Math.sin(travel * Math.PI * 2) * 1.3;
  const y = baseY + Math.cos(travel * Math.PI * 2) * 0.45;
  return { x: clamp(Number(x.toFixed(3)), 0.5, 23.5), y: clamp(Number(y.toFixed(3)), 0.5, 23.5) };
}

function buildSectors() {
  return Array.from({ length: SECTOR_COUNT }, (_, y) => Array.from({ length: SECTOR_COUNT }, (_, x) => ({
    id: sectorId(x, y), x, y,
    zone: y === 0 ? 'upper' : y === 1 ? 'middle' : 'lower',
    quality: y === 0 ? 'sturdy' : y === 1 ? 'mixed' : 'rough',
    bounds: { x: x * SECTOR_SIZE, y: y * SECTOR_SIZE, width: SECTOR_SIZE, height: SECTOR_SIZE }
  }))).flat();
}

function buildProps() {
  return STALLS.map(([type, structureId, stationId, x, y], index) => ({
    id: structureId, type, stationId, position: { x, y },
    condition: index % 2 ? 'sturdy' : 'patched',
    canvas: CANVAS_SPECS.structure
  }));
}

export function createCibolaDistrict({ gameMinute = 0 } = {}) {
  return projectCibolaDistrict(gameMinute);
}

export function projectCibolaDistrict(gameMinute = 0) {
  if (!Number.isSafeInteger(gameMinute) || gameMinute < 0) throw new RangeError('gameMinute must be a nonnegative integer');
  const definitions = [...ROLE_DEFS, ...LEGACY_DEFS];
  const npcs = definitions.map(([id, roleName, zone], index) => {
    const action = phaseFor(index, gameMinute);
    return {
      id, role: roleName, zone, position: actorPosition(index, zone, gameMinute),
      action, direction: directionFor(index, gameMinute), frame: frameFor(action, gameMinute, index),
      takeoverEligible: true, canvas: CANVAS_SPECS.npc
    };
  });
  return {
    id: 'cibola-nova-desert', version: 1, gameMinute,
    size: { width: DISTRICT_SIZE, height: DISTRICT_SIZE, sectorSize: SECTOR_SIZE },
    sectors: buildSectors(), zones: ZONE_CLASSES, props: buildProps(), npcs,
    player: { mode: 'npc-takeover', skinPolicy: 'reuse-selected-npc-skin' }
  };
}
