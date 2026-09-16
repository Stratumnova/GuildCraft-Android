import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera } from '../src/ui/camera.js';

test('follow, pan, home, and zoom alter the real camera state', () => {
  const camera = createCamera({ x: 32, y: 32, zoom: 1, minZoom: 0.5, maxZoom: 2 });
  camera.follow('mira');
  camera.updateFollow({ x: 12, y: 20 });
  assert.deepEqual(camera.snapshot(), { x: 12, y: 20, zoom: 1, followId: 'mira', selectedId: 'mira' });
  camera.pan(3, -2);
  assert.equal(camera.snapshot().followId, null);
  camera.zoomBy(5);
  assert.equal(camera.snapshot().zoom, 2);
  camera.home();
  assert.deepEqual(camera.snapshot(), { x: 32, y: 32, zoom: 1, followId: null, selectedId: null });
});
