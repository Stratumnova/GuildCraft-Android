import { stepMarket } from '../simulation/livingMarket.js';

export function createScheduler({
  getState,
  commit,
  step = stepMarket,
  baseStepsPerSecond = 1,
  maxStepsPerFrame = 240,
  requestFrame = callback => requestAnimationFrame(callback)
}) {
  let running = true;
  let speed = 1;
  let lastTimestamp = null;
  let accumulator = 0;

  function consume(count) {
    const events = [];
    for (let index = 0; index < count; index += 1) {
      const result = step(getState(), 1);
      commit(result.state);
      events.push(...(result.events ?? []));
      if (!result.ok) {
        running = false;
        break;
      }
    }
    return events;
  }

  function frame(timestamp) {
    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
      return;
    }
    const elapsedSeconds = Math.max(0, Math.min(1, (timestamp - lastTimestamp) / 1000));
    lastTimestamp = timestamp;
    if (!running) return;
    accumulator += elapsedSeconds * baseStepsPerSecond * speed;
    const available = Math.min(maxStepsPerFrame, Math.floor(accumulator));
    if (available > 0) {
      consume(available);
      accumulator -= available;
    }
  }

  return {
    frame,
    start() { running = true; lastTimestamp = null; requestFrame(frame); },
    pause() { running = false; commit({ ...getState(), paused: true }); },
    resume() { running = true; commit({ ...getState(), paused: false }); lastTimestamp = null; requestFrame(frame); },
    setSpeed(value) {
      if (![1, 2, 4].includes(value)) throw new RangeError('speed must be 1, 2, or 4');
      speed = value;
    },
    stepHour() {
      if (running) throw new Error('stepHour requires paused scheduler');
      return consume(60);
    },
    snapshot() { return { running, speed, accumulator }; }
  };
}
