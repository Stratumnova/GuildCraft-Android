const MASK_64 = (1n << 64n) - 1n;
const MULTIPLIER = 6364136223846793005n;

function parseWord(value, name) {
  if (typeof value === 'bigint') return value & MASK_64;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value) & MASK_64;
  if (typeof value === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(value)) {
    return BigInt(value.startsWith('0x') ? value : `0x${value}`) & MASK_64;
  }
  throw new TypeError(`${name} must be a nonnegative bigint, safe integer, or hexadecimal string`);
}

export function createPcg32(input = { seed: 0n, stream: 1n }) {
  let state;
  let increment;

  if (input.algorithm === 'pcg32') {
    state = parseWord(input.stateHex, 'stateHex');
    increment = parseWord(input.incrementHex, 'incrementHex') | 1n;
  } else {
    const seed = parseWord(input.seed ?? 0n, 'seed');
    const stream = parseWord(input.stream ?? 1n, 'stream');
    state = 0n;
    increment = ((stream << 1n) | 1n) & MASK_64;
    nextUint32();
    state = (state + seed) & MASK_64;
    nextUint32();
  }

  function nextUint32() {
    const oldState = state;
    state = (oldState * MULTIPLIER + increment) & MASK_64;
    const shifted = Number((((oldState >> 18n) ^ oldState) >> 27n) & 0xffffffffn) >>> 0;
    const rotation = Number((oldState >> 59n) & 31n);
    return ((shifted >>> rotation) | (shifted << ((32 - rotation) & 31))) >>> 0;
  }

  function nextFloat() {
    return nextUint32() / 0x100000000;
  }

  function nextInt(bound) {
    if (!Number.isSafeInteger(bound) || bound <= 0 || bound > 0x100000000) {
      throw new RangeError('bound must be an integer from 1 through 2^32');
    }
    const threshold = 0x100000000 % bound;
    let value;
    do value = nextUint32(); while (value < threshold);
    return value % bound;
  }

  function serialize() {
    return {
      algorithm: 'pcg32',
      stateHex: state.toString(16).padStart(16, '0'),
      incrementHex: increment.toString(16).padStart(16, '0')
    };
  }

  return { nextUint32, nextFloat, nextInt, serialize };
}
