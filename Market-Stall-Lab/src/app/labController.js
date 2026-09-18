import { createMarket, stepMarket } from '../simulation/livingMarket.js';
import { projectMarket } from '../projections/marketProjection.js';
import { projectTerminal } from '../projections/terminalProjection.js';
import { projectCibolaDistrict } from '../district/cibolaDistrict.js';
import { createCamera } from '../ui/camera.js';
import { buildJsonReport, buildTextReport } from './reportBuilder.js';

const MODES = new Set(['split', 'market', 'terminal']);

export function createLabController({
  seed = 25,
  stream = 77,
  sessionId = `seed-${seed}`,
  buildInfo,
  checkpoint = null
} = {}) {
  if (!buildInfo?.fingerprint) throw new Error('Lab controller requires build information');
  if (checkpoint && checkpoint.buildFingerprint !== buildInfo.fingerprint) {
    throw new Error('checkpoint build fingerprint does not match this Lab build');
  }
  let state = checkpoint ? structuredClone(checkpoint.state) : createMarket({ seed, stream, sessionId }).state;
  let journal = checkpoint ? structuredClone(checkpoint.journal ?? []) : [];
  let running = !state.paused;
  let destroyed = false;
  let mode = checkpoint?.configuration?.mode ?? 'split';
  const camera = createCamera();

  function requireLive() {
    if (destroyed) throw new Error('Lab runtime has been destroyed');
  }

  function advance(minutes) {
    requireLive();
    const result = stepMarket(state, minutes);
    state = result.state;
    journal.push(...result.events);
    if (!result.ok) running = false;
    const followed = camera.snapshot().followId;
    if (followed) {
      const actor = projectMarket(state).actors.find(candidate => candidate.id === followed);
      camera.updateFollow(actor?.position);
    }
    return result;
  }

  const controller = {
    camera,
    get state() { return state; },
    get journal() { return journal; },
    snapshot() { return { running, destroyed, mode, gameMinute: state.gameMinute }; },
    runMinutes(minutes) {
      if (!running) throw new Error('runMinutes requires a running Lab');
      return advance(minutes);
    },
    pause() { requireLive(); running = false; state = { ...state, paused: true }; },
    resume() { requireLive(); state = { ...state, paused: false }; running = true; },
    stepHour() {
      if (running) throw new Error('stepHour requires a paused Lab');
      return advance(60);
    },
    setMode(nextMode) {
      requireLive();
      if (!MODES.has(nextMode)) throw new Error(`invalid mode ${nextMode}`);
      mode = nextMode;
      return mode;
    },
    selectActor(actorId) {
      if (!state.actors[actorId]) throw new Error(`unknown actor ${actorId}`);
      return camera.select(actorId);
    },
    followActor(actorId) {
      if (!state.actors[actorId]) throw new Error(`unknown actor ${actorId}`);
      const actor = projectMarket(state).actors.find(candidate => candidate.id === actorId);
      camera.follow(actorId);
      return camera.updateFollow(actor.position);
    },
    marketView() { return projectMarket(state); },
    districtView() { return projectCibolaDistrict(state.gameMinute); },
    terminalView(filters = {}) { return projectTerminal(state, journal, filters); },
    createCheckpoint() {
      requireLive();
      return structuredClone({
        schemaVersion: 1,
        buildFingerprint: buildInfo.fingerprint,
        state,
        journal,
        configuration: { seed, stream, mode }
      });
    },
    buildJsonEvidence({ exportedAt } = {}) {
      return buildJsonReport({
        build: buildInfo,
        checkpoint: controller.createCheckpoint(),
        configuration: { seed, stream, mode },
        exportedAt,
        journal,
        ledger: state.ledger,
        marks: state.marks,
        warnings: state.warnings
      });
    },
    buildTextEvidence({ exportedAt } = {}) {
      return buildTextReport({
        build: buildInfo,
        checkpoint: controller.createCheckpoint(),
        configuration: { seed, stream, mode },
        exportedAt,
        journal,
        ledger: state.ledger,
        marks: state.marks,
        warnings: state.warnings
      });
    },
    destroy() { destroyed = true; running = false; }
  };
  return controller;
}
