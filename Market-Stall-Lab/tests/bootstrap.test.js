import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrap } from '../src/app/bootstrap.js';

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.textContent = '';
    this.listeners = new Map();
    this.width = 960;
    this.height = 540;
    this.clientWidth = 960;
    this.clientHeight = 540;
    this.value = '';
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = [...children]; }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  removeEventListener(name) { this.listeners.delete(name); }
  click() { return this.listeners.get('click')?.({ currentTarget: this, target: this }); }
  remove() {}
  getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight }; }
  getContext() {
    return {
      clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
      arc() {}, fill() {}, fillText() {}
    };
  }
}

class FakeDocument {
  constructor() {
    this.created = [];
    this.body = new FakeElement('body', this);
    this.app = new FakeElement('main', this);
    this.app.id = 'app';
    this.body.append(this.app);
  }
  createElement(tag) {
    const element = new FakeElement(tag, this);
    this.created.push(element);
    return element;
  }
  getElementById(id) { return id === 'app' ? this.app : null; }
}

function descendants(root) {
  return [root, ...root.children.flatMap(descendants)];
}

test('launch mounts the autonomous market and terminal instead of the title-only shell', async () => {
  const document = new FakeDocument();
  const intervals = [];
  const storageValues = new Map();
  const storage = {
    getItem(key) { return storageValues.get(key) ?? null; },
    setItem(key, value) { storageValues.set(key, value); }
  };

  const runtime = await bootstrap({
    document,
    platform: null,
    storage,
    timers: {
      setInterval(callback) { intervals.push(callback); return intervals.length; },
      clearInterval() {}
    }
  });

  const mounted = descendants(document.app);
  assert.ok(mounted.some(node => node.dataset.role === 'toolbar'));
  assert.ok(mounted.some(node => node.dataset.role === 'market-canvas'));
  assert.ok(mounted.some(node => node.dataset.role === 'terminal'));
  assert.ok(mounted.some(node => node.dataset.role === 'build-fingerprint' && node.textContent.length > 0));
  assert.equal(runtime.controller.state.gameMinute, 0);
  assert.equal(intervals.length, 1);

  await intervals[0]();

  assert.equal(runtime.controller.state.gameMinute, 1);
  assert.match(mounted.find(node => node.dataset.role === 'clock').textContent, /DAY 1 00:01/);
  await runtime.destroy();
});

test('operator controls change canonical runtime state and create checkpoint and evidence files', async () => {
  const document = new FakeDocument();
  const intervals = [];
  const storageValues = new Map();
  const runtime = await bootstrap({
    document,
    platform: null,
    storage: {
      getItem(key) { return storageValues.get(key) ?? null; },
      setItem(key, value) { storageValues.set(key, value); }
    },
    timers: {
      setInterval(callback) { intervals.push(callback); return 1; },
      clearInterval() {}
    }
  });

  await runtime.handleAction('speed-4');
  await intervals[0]();
  assert.equal(runtime.controller.state.gameMinute, 4);
  await runtime.handleAction('pause');
  await intervals[0]();
  assert.equal(runtime.controller.state.gameMinute, 4);
  await runtime.handleAction('step-hour');
  assert.equal(runtime.controller.state.gameMinute, 64);
  await runtime.handleAction('mode-terminal');
  assert.equal(document.app.dataset.mode, 'terminal');

  runtime.elements.actorSelect.value = 'mira';
  await runtime.handleAction('follow');
  assert.equal(runtime.controller.camera.snapshot().followId, 'mira');
  await runtime.handleAction('checkpoint');
  assert.match(storageValues.get('market-lab:checkpoint:v1'), /MARKET_LAB_CHECKPOINT_V1/);

  await runtime.handleAction('export-json');
  await runtime.handleAction('export-txt');
  assert.ok(document.created.some(node => node.download === 'market-lab-report.json'));
  assert.ok(document.created.some(node => node.download === 'market-lab-report.txt'));
  await runtime.destroy();
});

test('Android export opens native Save As and reports only its confirmed content URI', async () => {
  const document = new FakeDocument();
  const writes = [];
  const runtime = await bootstrap({
    document,
    platform: {
      Plugins: {
        FileSave: {
          async saveFile(file) {
            writes.push(file);
            return { uri: 'content://documents/market-lab-report.json' };
          }
        }
      }
    },
    storage: { getItem() { return null; }, setItem() {} },
    timers: { setInterval() { return 1; }, clearInterval() {} }
  });

  await runtime.handleAction('export-json');

  assert.equal(writes.length, 1);
  assert.equal(writes[0].name, 'market-lab-report.json');
  assert.equal(writes[0].mimeType, 'application/json');
  assert.match(writes[0].text, /"checkpoint"/);
  assert.equal(runtime.elements.notice.textContent, 'Saved content://documents/market-lab-report.json');
  await runtime.destroy();
});
