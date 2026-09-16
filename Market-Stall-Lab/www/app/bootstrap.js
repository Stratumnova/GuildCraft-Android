import { createCheckpointStore } from '../adapters/checkpointStore.js';
import { saveFile } from '../adapters/fileExporter.js';
import { BUILD_INFO } from '../generated/buildInfo.js';
import { createMarketRenderer } from '../ui/marketRenderer.js';
import { createTerminalView } from '../ui/terminalView.js';
import { createLayoutController } from '../ui/layout.js';
import { createLabController } from './labController.js';

const SPEEDS = new Set([1, 2, 4]);

function makeElement(document, tag, { className = '', text = '', role = '', action = '' } = {}) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  if (role) element.dataset.role = role;
  if (action) element.dataset.action = action;
  return element;
}

function makeButton(document, text, action) {
  return makeElement(document, 'button', { text, action });
}

function formatClock(gameMinute) {
  const day = Math.floor(gameMinute / 1_440) + 1;
  const minuteOfDay = gameMinute % 1_440;
  const hour = Math.floor(minuteOfDay / 60).toString().padStart(2, '0');
  const minute = (minuteOfDay % 60).toString().padStart(2, '0');
  return `DAY ${day} ${hour}:${minute}`;
}

function mountShell(document, root) {
  const toolbar = makeElement(document, 'header', { className: 'toolbar', role: 'toolbar' });
  const modes = makeElement(document, 'div', { className: 'control-group' });
  modes.append(
    makeButton(document, 'MARKET', 'mode-market'),
    makeButton(document, 'SPLIT', 'mode-split'),
    makeButton(document, 'TERMINAL', 'mode-terminal')
  );
  const transport = makeElement(document, 'div', { className: 'control-group' });
  transport.append(
    makeButton(document, 'PAUSE', 'pause'),
    makeButton(document, 'RESUME', 'resume'),
    makeButton(document, '+1 HOUR', 'step-hour')
  );
  const speed = makeElement(document, 'div', { className: 'control-group' });
  speed.append(
    makeButton(document, '1×', 'speed-1'),
    makeButton(document, '2×', 'speed-2'),
    makeButton(document, '4×', 'speed-4')
  );
  const evidence = makeElement(document, 'div', { className: 'control-group' });
  evidence.append(
    makeButton(document, 'CHECKPOINT', 'checkpoint'),
    makeButton(document, 'JSON', 'export-json'),
    makeButton(document, 'TXT', 'export-txt')
  );
  const actorSelect = makeElement(document, 'select', { role: 'actor-select' });
  const camera = makeElement(document, 'div', { className: 'control-group' });
  camera.append(actorSelect, makeButton(document, 'FOLLOW', 'follow'), makeButton(document, 'HOME', 'home'));
  const clock = makeElement(document, 'output', { className: 'clock', role: 'clock' });
  const fingerprint = makeElement(document, 'output', { className: 'fingerprint', role: 'build-fingerprint' });
  toolbar.append(modes, transport, speed, camera, evidence, clock, fingerprint);

  const main = makeElement(document, 'section', { className: 'lab-main' });
  const marketPane = makeElement(document, 'section', { className: 'market-pane' });
  const canvas = makeElement(document, 'canvas', { role: 'market-canvas' });
  marketPane.append(canvas);
  const terminalPane = makeElement(document, 'aside', { className: 'terminal-pane', role: 'terminal' });
  main.append(marketPane, terminalPane);
  const notice = makeElement(document, 'output', { className: 'notice', role: 'notice' });
  root.replaceChildren(toolbar, main, notice);
  return { toolbar, actorSelect, clock, fingerprint, canvas, terminalPane, notice };
}

function resolveAppPlugin(platform) {
  return platform?.Plugins?.App ?? platform?.App ?? null;
}

export async function bootstrap({
  document,
  platform,
  storage = globalThis.localStorage,
  timers = globalThis,
  buildInfo = BUILD_INFO
}) {
  const root = document.getElementById('app');
  if (!root) throw new Error('Market Stall Lab requires #app');

  const checkpointStore = createCheckpointStore({ storage });
  const loaded = await checkpointStore.loadCheckpoint();
  let checkpoint = null;
  let startupNotice = '';
  if (loaded.ok && loaded.checkpoint.buildFingerprint === buildInfo.fingerprint) {
    checkpoint = loaded.checkpoint;
  } else if (loaded.ok) {
    startupNotice = 'Stored checkpoint belongs to a different build; started a fresh Lab.';
  } else if (loaded.reason !== 'NOT_FOUND') {
    startupNotice = `Checkpoint not loaded: ${loaded.reason}`;
  }

  const controller = createLabController({ buildInfo, checkpoint });
  const elements = mountShell(document, root);
  const layout = createLayoutController({ root, simulation: controller, initialMode: controller.snapshot().mode });
  const marketRenderer = createMarketRenderer({ canvas: elements.canvas, camera: controller.camera });
  const terminalView = createTerminalView({ root: elements.terminalPane, document });
  let speed = 1;
  let destroyed = false;
  let saveInFlight = Promise.resolve();
  const app = resolveAppPlugin(platform);
  const nativeListeners = [];

  for (const actor of controller.marketView().actors) {
    const option = makeElement(document, 'option', { text: actor.id });
    option.value = actor.id;
    elements.actorSelect.append(option);
  }

  function resizeCanvas() {
    const bounds = elements.canvas.getBoundingClientRect?.();
    const width = Math.max(320, Math.floor(bounds?.width || elements.canvas.clientWidth || 960));
    const height = Math.max(240, Math.floor(bounds?.height || elements.canvas.clientHeight || 540));
    if (elements.canvas.width !== width) elements.canvas.width = width;
    if (elements.canvas.height !== height) elements.canvas.height = height;
  }

  function render() {
    resizeCanvas();
    const snapshot = controller.snapshot();
    elements.clock.textContent = `${formatClock(snapshot.gameMinute)} · ${snapshot.running ? 'RUNNING' : 'PAUSED'} · ${speed}×`;
    elements.fingerprint.textContent = `BUILD ${buildInfo.fingerprint}`;
    marketRenderer.render(controller.marketView());
    terminalView.render(controller.terminalView());
  }

  async function saveCheckpoint() {
    const checkpointToSave = controller.createCheckpoint();
    saveInFlight = saveInFlight.then(() => checkpointStore.saveCheckpoint(checkpointToSave));
    const saved = await saveInFlight;
    elements.notice.textContent = `Checkpoint saved ${saved.checksum.slice(0, 12)}`;
    return saved;
  }

  async function exportEvidence(kind) {
    const json = kind === 'json';
    const result = await saveFile({
      name: `market-lab-report.${kind}`,
      mimeType: json ? 'application/json' : 'text/plain',
      bytes: json ? controller.buildJsonEvidence() : controller.buildTextEvidence(),
      document
    });
    elements.notice.textContent = `Saved ${result.name ?? result.uri}`;
    return result;
  }

  function setMode(mode) {
    controller.setMode(mode);
    layout.setMode(mode);
    render();
  }

  async function handleAction(action) {
    if (action.startsWith('mode-')) setMode(action.slice(5));
    else if (action === 'pause') { controller.pause(); render(); }
    else if (action === 'resume') { controller.resume(); render(); }
    else if (action === 'step-hour') { controller.stepHour(); render(); }
    else if (action.startsWith('speed-')) {
      const nextSpeed = Number(action.slice(6));
      if (!SPEEDS.has(nextSpeed)) throw new RangeError('invalid Lab speed');
      speed = nextSpeed;
      render();
    } else if (action === 'follow') {
      controller.followActor(elements.actorSelect.value || controller.marketView().actors[0].id);
      render();
    } else if (action === 'home') { controller.camera.home(); render(); }
    else if (action === 'checkpoint') await saveCheckpoint();
    else if (action === 'export-json') await exportEvidence('json');
    else if (action === 'export-txt') await exportEvidence('txt');
  }

  for (const group of elements.toolbar.children) {
    for (const control of group.children ?? []) {
      if (control.dataset?.action) control.addEventListener('click', () => handleAction(control.dataset.action).catch(error => {
        controller.pause();
        elements.notice.textContent = `ERROR ${error.message}`;
        render();
      }));
    }
  }

  const intervalId = timers.setInterval(async () => {
    if (destroyed || !controller.snapshot().running) return;
    try {
      controller.runMinutes(speed);
      render();
      if (controller.state.gameMinute % 60 === 0) await saveCheckpoint();
    } catch (error) {
      controller.pause();
      elements.notice.textContent = `SIMULATION PAUSED: ${error.message}`;
      render();
    }
  }, 1_000);

  if (app?.addListener) {
    nativeListeners.push(await app.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) await saveCheckpoint();
    }));
    nativeListeners.push(await app.addListener('backButton', async () => {
      if (layout.mode === 'terminal') return setMode('market');
      await saveCheckpoint();
      await app.exitApp?.();
    }));
  }

  elements.notice.textContent = startupNotice;
  render();

  return {
    controller,
    elements,
    get speed() { return speed; },
    setMode,
    handleAction,
    render,
    async destroy() {
      destroyed = true;
      timers.clearInterval(intervalId);
      await saveInFlight;
      for (const listener of nativeListeners) await listener?.remove?.();
      controller.destroy();
    }
  };
}
