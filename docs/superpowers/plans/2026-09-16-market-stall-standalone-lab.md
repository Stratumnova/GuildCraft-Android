# Market Stall Standalone Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an autonomous Android Market Stall laboratory whose renderer, terminal, persistence, and exports project one deterministic `LivingMarket` state with no GuildCraft runtime dependency.

**Architecture:** A pure simulation core accepts commands and fixed time steps, validates candidate state transactionally, and commits canonical events and state. Browser adapters schedule steps, render projections, persist checkpoints, and export evidence; the Capacitor shell supplies Android lifecycle and file-save integration. Portal, Trapline, playable Market globals, and clipboard transfer are prohibited.

**Tech Stack:** JavaScript ES modules, HTML Canvas, CSS, Node test runner, Capacitor 8, `@capacitor/app`, Java 21, Gradle, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-market-stall-standalone-lab-design.md`

## Global Constraints

- Android application name is `Market Stall Lab`.
- Android application ID is `org.neocities.guildcraft.marketlab`.
- `LivingMarket` is the sole authority for actors, stalls, clock, RNG, travel, ledger, and events.
- Simulation uses fixed one-game-minute steps; speed changes consumption rate only.
- Checkpoints serialize complete `PCG32` state/stream values and authoritative travel state.
- Portal, Trapline, room-host, playable-player, and clipboard APIs are forbidden.
- JSON exports separate `checkpoint`, `journal`, `ledger`, `warnings`, `marks`, `configuration`, and `build`.
- One build-generated fingerprint appears in UI, checkpoint, exports, and compiled-APK audit.
- Existing GuildCraft and previous standalone artifacts remain untouched.

## File Structure

Create a new `Market-Stall-Lab/` project. `src/simulation/` owns pure deterministic state transitions. `src/app/` owns scheduling and application composition. `src/projections/` converts canonical state into view models. `src/adapters/` contains browser/Android side effects. `src/ui/` renders the market and terminal. Tests mirror these boundaries. No existing playable Market runtime is copied wholesale.

---

### Task 1: Project Boundary and Forbidden-Dependency Gate

**Files:**
- Create: `Market-Stall-Lab/package.json`
- Create: `Market-Stall-Lab/capacitor.config.json`
- Create: `Market-Stall-Lab/src/index.html`
- Create: `Market-Stall-Lab/src/app/bootstrap.js`
- Create: `Market-Stall-Lab/tests/boundary.test.js`

**Interfaces:**
- Produces: `bootstrap({document, platform}) -> Promise<AppController>` entry point.
- Consumes: no GuildCraft runtime.

- [ ] **Step 1: Write the failing boundary test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('lab source excludes front-facing dependencies and clipboard transfer', () => {
  const root = new URL('../src/', import.meta.url);
  const files = fs.readdirSync(root, {recursive: true})
    .filter(name => /\.(js|html|css)$/.test(name));
  const source = files.map(name => fs.readFileSync(new URL(name, root), 'utf8')).join('\n');
  for (const forbidden of ['trapline/', 'portal/', 'roomHost', 'navigator.clipboard', 'playerTransfer']) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd Market-Stall-Lab && node --test tests/boundary.test.js`  
Expected: FAIL because the project entry files do not exist.

- [ ] **Step 3: Create the minimal independent shell**

Use package scripts:

```json
{
  "name": "market-stall-lab",
  "private": true,
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "test": "node --test tests/*.test.js",
    "sync:android": "node scripts/build-web.js && npx cap sync android"
  },
  "dependencies": {
    "@capacitor/android": "8.1.0",
    "@capacitor/app": "8.1.1",
    "@capacitor/core": "8.1.0"
  },
  "devDependencies": {"@capacitor/cli": "8.1.0"}
}
```

Set `appId` to `org.neocities.guildcraft.marketlab`, `appName` to `Market Stall Lab`, and `webDir` to `www`. `index.html` imports only `./app/bootstrap.js` and invokes `bootstrap` on `DOMContentLoaded`.

- [ ] **Step 4: Run the boundary test and verify GREEN**

Run: `cd Market-Stall-Lab && node --test tests/boundary.test.js`  
Expected: PASS with one test and zero failures.

- [ ] **Step 5: Commit**

```bash
git add Market-Stall-Lab
git commit -m "feat: establish isolated Market Stall Lab shell"
```

---

### Task 2: Canonical State, Serializable PCG32, and Travel

**Files:**
- Create: `Market-Stall-Lab/src/simulation/rng.js`
- Create: `Market-Stall-Lab/src/simulation/schema.js`
- Create: `Market-Stall-Lab/src/simulation/travel.js`
- Create: `Market-Stall-Lab/src/simulation/livingMarket.js`
- Create: `Market-Stall-Lab/tests/determinism.test.js`
- Create: `Market-Stall-Lab/tests/travel.test.js`

**Interfaces:**
- Produces: `createPcg32(seedOrState)`, `nextUint32()`, `nextFloat()`, `nextInt(bound)`, `createMarket(config)`, `stepMarket(state, minutes)`, `projectTravel(travel, gameMinute)`.
- `createMarket` returns `{state, events}`; `stepMarket` returns `{ok, state, events, failure}` without mutating input.

- [ ] **Step 1: Write failing RNG and travel tests**

```js
test('serialized PCG32 resumes the same sequence', () => {
  const first = createPcg32({seed:25n, stream:54n});
  first.nextUint32(); first.nextUint32();
  const resumed = createPcg32(first.serialize());
  assert.deepEqual(
    [resumed.nextUint32(), resumed.nextUint32()],
    [first.nextUint32(), first.nextUint32()]
  );
});

test('travel projection interpolates authoritative progress', () => {
  const travel = {from:{x:0,y:0}, to:{x:10,y:20}, departureMinute:100, arrivalMinute:120};
  assert.deepEqual(projectTravel(travel, 110), {x:5, y:10, progress:0.5});
});
```

- [ ] **Step 2: Verify both tests fail for missing modules**

Run: `cd Market-Stall-Lab && node --test tests/determinism.test.js tests/travel.test.js`  
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Implement serializable PCG32 and canonical schema**

Use PCG-XSH-RR with 64-bit `BigInt` state and odd stream increment. `serialize()` returns `{algorithm:'pcg32', stateHex, incrementHex}` so JSON never loses integer precision. `nextFloat()` divides unsigned 32-bit output by `2 ** 32`. `nextInt(bound)` uses rejection sampling with threshold `2 ** 32 % bound`; it must not use raw low bits or direct modulo selection. Canonical state contains `schemaVersion`, `sessionId`, `seed`, `rngState`, `gameMinute`, `actors`, `stalls`, `ledger`, `eventSequence`, `warnings`, and `paused`.

Add PCG32 reference-vector assertions, 100 serialize/resume split points, range assertions for bounds `2`, `3`, `7`, `10`, and `257`, and a distribution smoke test over 100,000 draws whose tolerance is loose enough to avoid flaky failures but rejects severe bucket collapse.

Actor travel state is either `null` or:

```js
{
  locationId: 'home:mira',
  destinationId: 'stall:food',
  routeId: 'home:mira->stall:food',
  path: [{x:12,y:8},{x:18,y:12},{x:24,y:17}],
  departureMinute: 470,
  arrivalMinute: 500,
  progress: 0
}
```

- [ ] **Step 4: Implement immutable `stepMarket`**

Clone canonical input, restore PCG32 from `rngState`, process exactly `minutes` one-minute transitions, persist updated PCG32 state, and return a new state. Never use `Date.now()`, `Math.random()`, raw RNG low bits, or render-frame time in simulation logic.

- [ ] **Step 5: Verify determinism and travel tests pass**

Run: `cd Market-Stall-Lab && node --test tests/determinism.test.js tests/travel.test.js`  
Expected: PASS with zero failures.

- [ ] **Step 6: Commit**

```bash
git add Market-Stall-Lab/src/simulation Market-Stall-Lab/tests
git commit -m "feat: add deterministic canonical market state"
```

---

### Task 3: Transactional Economy and Invariant Gate

**Files:**
- Create: `Market-Stall-Lab/src/simulation/economy.js`
- Create: `Market-Stall-Lab/src/simulation/invariants.js`
- Modify: `Market-Stall-Lab/src/simulation/livingMarket.js`
- Create: `Market-Stall-Lab/tests/economy.test.js`
- Create: `Market-Stall-Lab/tests/invariants.test.js`

**Interfaces:**
- Produces: `chooseIntent(actor, state)`, `applyEconomyMinute(candidate, emit)`, `validateState(candidate) -> {ok, violations}`.
- Consumes: canonical state and serialized RNG from Task 2.

- [ ] **Step 1: Write a failing shared-state purchase test**

```js
test('purchase updates one canonical actor, stall, ledger, and event stream', () => {
  const before = fixtureReadyPurchase();
  const result = stepMarket(before, 1);
  assert.equal(result.ok, true);
  assert.equal(result.state.actors.buyer.currency, before.actors.buyer.currency - 5);
  assert.equal(result.state.stalls.food.display.ration, before.stalls.food.display.ration - 1);
  assert.equal(result.state.stalls.food.till, before.stalls.food.till + 5);
  assert.equal(result.state.ledger.at(-1).type, 'STALL_SALE');
});
```

- [ ] **Step 2: Write a failing rejected-candidate test**

```js
test('invalid candidate preserves last state and pauses', () => {
  const before = fixtureReadyPurchase({stallDisplay:-1});
  const result = stepMarket(before, 1);
  assert.equal(result.ok, false);
  assert.deepEqual(result.state.actors, before.actors);
  assert.deepEqual(result.state.stalls, before.stalls);
  assert.equal(result.state.paused, true);
  assert.equal(result.failure.type, 'INVARIANT_FAILURE');
});
```

- [ ] **Step 3: Verify both tests fail**

Run: `cd Market-Stall-Lab && node --test tests/economy.test.js tests/invariants.test.js`  
Expected: FAIL because canonical purchases and pre-commit validation are absent.

- [ ] **Step 4: Implement behavior and invariant validation**

Implement schedules, needs, sourcing, display restocking, affordability checks, sales, failed purchases, consumption, rest, stall pressure, and travel commands. Validate nonnegative balances/quantities, finite needs, valid entity references, monotonic event sequence, ledger arithmetic, and travel timing before commit.

- [ ] **Step 5: Run economy, invariant, and determinism suites**

Run: `cd Market-Stall-Lab && node --test tests/economy.test.js tests/invariants.test.js tests/determinism.test.js`  
Expected: PASS with zero failures.

- [ ] **Step 6: Commit**

```bash
git add Market-Stall-Lab/src/simulation Market-Stall-Lab/tests
git commit -m "feat: add transactional autonomous economy"
```

---

### Task 4: Scheduler and Seven-Day Resume Equivalence

**Files:**
- Create: `Market-Stall-Lab/src/app/scheduler.js`
- Create: `Market-Stall-Lab/src/simulation/canonicalize.js`
- Create: `Market-Stall-Lab/tests/scheduler.test.js`
- Create: `Market-Stall-Lab/tests/sevenDayAcceptance.test.js`

**Interfaces:**
- Produces: `createScheduler({getState, commit, now, requestFrame})` with `pause()`, `resume()`, `setSpeed(1|2|4)`, `stepHour()`, `frame(timestamp)`.
- Produces: `canonicalHash(value) -> lowercase SHA-256 hex` in Node; browser adapter uses Web Crypto asynchronously.

- [ ] **Step 1: Write failing scheduler tests**

```js
test('speed changes fixed-step count, never delta size', () => {
  const deltas = [];
  const scheduler = fixtureScheduler(delta => deltas.push(delta));
  scheduler.setSpeed(4); scheduler.frame(0); scheduler.frame(1000);
  assert(deltas.length > 1);
  assert(deltas.every(delta => delta === 1));
});

test('stepHour advances exactly sixty fixed steps while paused', () => {
  const deltas = [];
  const scheduler = fixtureScheduler(delta => deltas.push(delta));
  scheduler.pause(); scheduler.stepHour();
  assert.deepEqual(deltas, Array(60).fill(1));
});
```

- [ ] **Step 2: Write the failing uninterrupted/resumed hash test**

Run seed `25` uninterrupted for 10,080 minutes. Run it again for 4,320 minutes, serialize and parse the checkpoint, reconstruct the runtime, and continue for 5,760 minutes. Assert equal canonical final-state hashes and equal canonical event hashes.

- [ ] **Step 3: Verify RED**

Run: `cd Market-Stall-Lab && node --test tests/scheduler.test.js tests/sevenDayAcceptance.test.js`  
Expected: FAIL because scheduler and canonical hashing are missing.

- [ ] **Step 4: Implement fixed-step scheduling and canonical hashing**

Sort object keys recursively, preserve array order, omit presentation-only state, and hash UTF-8 canonical JSON. Cap each animation frame to a bounded number of simulation steps and carry remaining accumulator time forward.

- [ ] **Step 5: Verify GREEN**

Run: `cd Market-Stall-Lab && node --test tests/scheduler.test.js tests/sevenDayAcceptance.test.js`  
Expected: PASS; uninterrupted and resumed hashes match.

- [ ] **Step 6: Commit**

```bash
git add Market-Stall-Lab/src Market-Stall-Lab/tests
git commit -m "feat: add fixed-step laboratory scheduler"
```

---

### Task 5: Projections, Real Camera, and Three Display Modes

**Files:**
- Create: `Market-Stall-Lab/src/projections/marketProjection.js`
- Create: `Market-Stall-Lab/src/projections/terminalProjection.js`
- Create: `Market-Stall-Lab/src/ui/camera.js`
- Create: `Market-Stall-Lab/src/ui/marketRenderer.js`
- Create: `Market-Stall-Lab/src/ui/terminalView.js`
- Create: `Market-Stall-Lab/src/ui/layout.js`
- Create: `Market-Stall-Lab/src/ui/styles.css`
- Create: `Market-Stall-Lab/tests/projections.test.js`
- Create: `Market-Stall-Lab/tests/camera.test.js`
- Create: `Market-Stall-Lab/tests/modes.test.js`

**Interfaces:**
- Produces: `projectMarket(state)`, `projectTerminal(state, filters)`, `createCamera()`, `setMode('split'|'market'|'terminal')`.
- Consumes: canonical state only; projection output is read-only.

- [ ] **Step 1: Write failing travel/render projection test**

```js
test('rendered actor coordinates come from authoritative travel', () => {
  const state = fixtureTravel({departureMinute:100, arrivalMinute:120, gameMinute:110});
  const view = projectMarket(state);
  assert.deepEqual(view.actors[0].position, {x:5, y:10, progress:0.5});
});
```

- [ ] **Step 2: Write failing real-camera tests**

Assert follow centers on projected actor coordinates, pan clears `followId`, home restores initial center/zoom, and zoom clamps to configured bounds.

- [ ] **Step 3: Write failing mode-continuity test**

Switch `split -> terminal -> market -> split` and assert the controller retains the exact same scheduler and canonical state object identity between simulation commits.

- [ ] **Step 4: Verify RED**

Run: `cd Market-Stall-Lab && node --test tests/projections.test.js tests/camera.test.js tests/modes.test.js`  
Expected: FAIL for missing projection/UI modules.

- [ ] **Step 5: Implement projection-driven UI**

Market view renders actors, stalls, travel, open state, display pressure, and selection from `projectMarket`. Terminal view renders filters, actor/stall inspectors, ledger, warnings, and event rows from `projectTerminal`. Mode switching changes CSS layout only.

- [ ] **Step 6: Verify projection and camera suites**

Run: `cd Market-Stall-Lab && node --test tests/projections.test.js tests/camera.test.js tests/modes.test.js`  
Expected: PASS with zero failures.

- [ ] **Step 7: Commit**

```bash
git add Market-Stall-Lab/src Market-Stall-Lab/tests
git commit -m "feat: render canonical market and terminal projections"
```

---

### Task 6: Checkpoints, Lifecycle, and Evidence Exports

**Files:**
- Create: `Market-Stall-Lab/src/adapters/checkpointStore.js`
- Create: `Market-Stall-Lab/src/adapters/fileExporter.js`
- Create: `Market-Stall-Lab/src/adapters/androidLifecycle.js`
- Create: `Market-Stall-Lab/src/app/reportBuilder.js`
- Create: `Market-Stall-Lab/tests/persistence.test.js`
- Create: `Market-Stall-Lab/tests/export.test.js`
- Create: `Market-Stall-Lab/tests/lifecycle.test.js`

**Interfaces:**
- Produces: `saveCheckpoint(checkpoint)`, `loadCheckpoint()`, `buildJsonReport(context)`, `buildTextReport(context)`, `saveFile({name,mimeType,bytes})`.
- Consumes: canonical state, journal, marks, configuration, build fingerprint.

- [ ] **Step 1: Write failing checkpoint validation test**

Save then load a valid checkpoint and assert deep equality including `rngState` and travel. Corrupt its checksum and assert `{ok:false, reason:'CHECKSUM_MISMATCH', recoverableExport}` without executing the state.

- [ ] **Step 2: Write failing structured-export test**

```js
test('JSON evidence separates checkpoint from evidence streams', () => {
  const report = JSON.parse(buildJsonReport(fixtureReportContext()));
  assert.deepEqual(Object.keys(report).sort(),
    ['build','checkpoint','configuration','exportedAt','journal','ledger','marks','warnings'].sort());
  assert.equal(report.build.fingerprint, report.checkpoint.buildFingerprint);
});
```

- [ ] **Step 3: Write failing lifecycle test**

Assert backgrounding saves once, resuming loads without offline advancement, and Android Back closes dialog/terminal before invoking double-back exit.

- [ ] **Step 4: Verify RED**

Run: `cd Market-Stall-Lab && node --test tests/persistence.test.js tests/export.test.js tests/lifecycle.test.js`  
Expected: FAIL for missing adapters.

- [ ] **Step 5: Implement storage and real file export**

Use versioned local storage for checkpoints with canonical SHA-256 checksums. Use Android-compatible Blob/download handling through one `saveFile` adapter and browser download fallback. Never call `navigator.clipboard`. Report success only after adapter resolution.

- [ ] **Step 6: Verify GREEN**

Run: `cd Market-Stall-Lab && node --test tests/persistence.test.js tests/export.test.js tests/lifecycle.test.js`  
Expected: PASS with zero failures.

- [ ] **Step 7: Commit**

```bash
git add Market-Stall-Lab/src Market-Stall-Lab/tests
git commit -m "feat: persist and export Market Lab evidence"
```

---

### Task 7: Build Fingerprint, Android Project, and APK Audit

**Files:**
- Create: `Market-Stall-Lab/scripts/build-web.js`
- Create: `Market-Stall-Lab/scripts/audit-apk.js`
- Generate: `Market-Stall-Lab/src/generated/buildInfo.js`
- Generate: `Market-Stall-Lab/www/`
- Generate: `Market-Stall-Lab/android/`
- Create: `Market-Stall-Lab/tests/buildFingerprint.test.js`
- Create: `.github/workflows/market-stall-lab-android.yml`

**Interfaces:**
- Produces: `BUILD_INFO = {version, commit, fingerprint, builtAt}`.
- Consumes: `GITHUB_SHA`, package version, UTC build timestamp.

- [ ] **Step 1: Write failing fingerprint-consistency test**

Generate a fixture build and assert UI module, checkpoint fixture, JSON report, TXT report, and `www/build-info.json` contain one identical fingerprint.

- [ ] **Step 2: Verify RED**

Run: `cd Market-Stall-Lab && node --test tests/buildFingerprint.test.js`  
Expected: FAIL because build generation is absent.

- [ ] **Step 3: Implement build generation**

Compute fingerprint as the first 12 lowercase hex characters of SHA-256 over `version + '\n' + commit + '\n' + builtAt`. Generate `buildInfo.js` and `build-info.json`, then copy only lab assets into `www`.

- [ ] **Step 4: Generate Android shell**

Run:

```bash
cd Market-Stall-Lab
npm ci
node scripts/build-web.js
npx cap add android
npx cap sync android
```

Set landscape orientation, app label `Market Stall Lab`, Java 21 compatibility, `versionCode 1`, and `versionName "0.1.0"`.

- [ ] **Step 5: Implement compiled-APK audit**

`audit-apk.js` opens the APK as ZIP and fails unless it finds lab entry assets, the generated fingerprint, autonomous simulation modules, and export modules. It also fails on case-insensitive matches for `trapline/`, `portal/`, `roomHost`, `navigator.clipboard`, or GuildCraft's front-facing application ID.

- [ ] **Step 6: Create GitHub workflow**

Workflow uses Node 22, Java 21, runs `npm ci`, full tests, web build, Capacitor sync, `./gradlew assembleDebug`, APK audit, and uploads artifact `Market-Stall-Lab-debug-apk` only after audit passes.

- [ ] **Step 7: Run all non-Android verification locally**

Run: `cd Market-Stall-Lab && npm test && node scripts/build-web.js`  
Expected: all tests PASS and `www/build-info.json` exists.

- [ ] **Step 8: Commit**

```bash
git add Market-Stall-Lab .github/workflows/market-stall-lab-android.yml
git commit -m "build: add audited Market Stall Lab APK pipeline"
```

---

### Task 8: End-to-End Acceptance and Baseline Evidence

**Files:**
- Create: `Market-Stall-Lab/tests/endToEndAcceptance.test.js`
- Create: `Market-Stall-Lab/docs/ACCEPTANCE.md`
- Create: `Market-Stall-Lab/fixtures/seed-25-seven-day-hashes.json`

**Interfaces:**
- Consumes every public interface produced by Tasks 1–7.
- Produces frozen seed-25 baseline hashes and acceptance record.

- [ ] **Step 1: Write the end-to-end acceptance test**

The test launches one app controller, confirms automatic start, runs seed `25` for seven days, selects/follows a traveling actor, switches all three modes, pauses, steps one hour, checkpoints, destroys/reloads runtime, continues, exports JSON/TXT, and compares uninterrupted/resumed hashes.

- [ ] **Step 2: Verify the acceptance test fails before fixture approval**

Run: `cd Market-Stall-Lab && node --test tests/endToEndAcceptance.test.js`  
Expected: FAIL with `seed-25-seven-day-hashes.json` absent.

- [ ] **Step 3: Review and freeze baseline hashes**

Run the deterministic acceptance generator once, inspect event counts, ledger totals, warnings, actor states, and stall states, then write the accepted state/event hashes and configuration into `fixtures/seed-25-seven-day-hashes.json`.

- [ ] **Step 4: Run full verification**

Run: `cd Market-Stall-Lab && npm test`  
Expected: every test PASS, zero failures, uninterrupted/resumed hashes equal, forbidden-dependency scan clean.

- [ ] **Step 5: Trigger and inspect GitHub APK build**

Confirm Gradle success, compiled-APK audit success, and artifact `Market-Stall-Lab-debug-apk`. Install beside GuildCraft; verify automatic start, mode switching, visible travel, terminal inspection, save/resume, and Android JSON/TXT file creation.

- [ ] **Step 6: Record acceptance evidence**

Write exact test command, test counts, baseline hashes, workflow run URL, artifact digest, installed application ID, exported filenames, and any operator observations in `Market-Stall-Lab/docs/ACCEPTANCE.md`.

- [ ] **Step 7: Commit**

```bash
git add Market-Stall-Lab/tests Market-Stall-Lab/fixtures Market-Stall-Lab/docs
git commit -m "test: certify Market Stall Lab acceptance baseline"
```
