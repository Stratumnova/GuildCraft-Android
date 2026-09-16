import test from 'node:test';
import assert from 'node:assert/strict';
import { createPcg32 } from '../src/simulation/rng.js';

test('PCG32 matches the canonical seed 42 stream 54 reference vector', () => {
  const rng = createPcg32({ seed: 42n, stream: 54n });
  const actual = Array.from({ length: 6 }, () => rng.nextUint32().toString(16).padStart(8, '0'));
  assert.deepEqual(actual, ['a15c02b7', '7b47f409', 'ba1d3330', '83d2f293', 'bfa4784b', 'cbed606e']);
});

test('serialized PCG32 resumes the same sequence at 100 split points', () => {
  for (let split = 0; split < 100; split += 1) {
    const first = createPcg32({ seed: 25n, stream: 77n });
    for (let i = 0; i < split; i += 1) first.nextUint32();
    const resumed = createPcg32(first.serialize());
    assert.deepEqual(
      Array.from({ length: 8 }, () => resumed.nextUint32()),
      Array.from({ length: 8 }, () => first.nextUint32())
    );
  }
});

test('bounded selection stays in range and avoids severe bucket collapse', () => {
  for (const bound of [2, 3, 7, 10, 257]) {
    const rng = createPcg32({ seed: 25n, stream: 91n });
    for (let i = 0; i < 10_000; i += 1) {
      const value = rng.nextInt(bound);
      assert(value >= 0 && value < bound);
    }
  }
  const rng = createPcg32({ seed: 25n, stream: 91n });
  const buckets = Array(10).fill(0);
  for (let i = 0; i < 100_000; i += 1) buckets[rng.nextInt(10)] += 1;
  assert(buckets.every(count => count > 9_000 && count < 11_000), buckets.join(','));
});
