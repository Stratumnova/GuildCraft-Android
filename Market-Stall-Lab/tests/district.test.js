import test from 'node:test';
import assert from 'node:assert/strict';
import { createCibolaDistrict, CANVAS_SPECS, DIRECTIONS, ACTIONS } from '../src/district/cibolaDistrict.js';

test('Cibola district is a continuous 24x24 world split into nine sectors', () => {
  const district = createCibolaDistrict();
  assert.deepEqual(district.size, { width: 24, height: 24, sectorSize: 8 });
  assert.equal(district.sectors.length, 9);
  assert.deepEqual(district.sectors.map(sector => sector.id), ['0,0', '1,0', '2,0', '0,1', '1,1', '2,1', '0,2', '1,2', '2,2']);
  assert.equal(district.sectors.every(sector => sector.bounds.width === 8 && sector.bounds.height === 8), true);
});

test('NPCs use reusable three-direction action strips and no north action', () => {
  const district = createCibolaDistrict({ gameMinute: 31 });
  assert.equal(district.npcs.length, 21);
  assert.equal(new Set(district.npcs.map(npc => npc.zone)).size, 3);
  assert.equal(district.npcs.every(npc => ACTIONS.includes(npc.action)), true);
  assert.equal(district.npcs.every(npc => DIRECTIONS.includes(npc.direction)), true);
  assert.equal(district.npcs.every(npc => npc.takeoverEligible), true);
  assert.deepEqual(CANVAS_SPECS.npc.anchor, [64, 188]);
});

test('district projection changes animation state without mutating market state', () => {
  const first = createCibolaDistrict({ gameMinute: 0 });
  const later = createCibolaDistrict({ gameMinute: 48 });
  assert.notDeepEqual(first.npcs.map(npc => [npc.action, npc.frame]), later.npcs.map(npc => [npc.action, npc.frame]));
  assert.deepEqual(first.props.map(prop => prop.id), later.props.map(prop => prop.id));
});
