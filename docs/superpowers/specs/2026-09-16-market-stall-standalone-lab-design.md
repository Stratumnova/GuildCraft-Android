# Market Stall Standalone Lab — Design Specification

**Status:** Proposed for operator review  
**Date:** 2026-09-16  
**Product:** Market Stall Standalone Lab  
**Separate product:** GuildCraft front-facing Portal + Trapline + playable Market

## 1. Purpose

Build a private Android test application that launches directly into an autonomous Market Stall simulation. The operator observes and tests a living economy, inspects its decisions through a terminal, pauses or advances time, and exports complete reports as real files.

The lab exists to generate evidence for later design decisions. It is not a playable room and is not a preview wrapper for the front-facing GuildCraft application.

## 2. Product Boundary

The project has two independent deliverables:

1. **Market Stall Standalone Lab** — autonomous, diagnostic, operator-facing.
2. **GuildCraft front-facing build** — playable Market integrated with Portal and Trapline.

The lab must not:

- import Portal or Trapline runtime files;
- display Portal, room-host, player-transfer, or return-to-Portal controls;
- read or write Portal/Trapline save keys;
- share an Android application ID with GuildCraft;
- require player movement or player interaction to keep the economy running;
- use clipboard codes as its report or save mechanism;
- silently copy experimental state into the front-facing build.

Simulation findings may later be manually selected for the front-facing game. That transfer is a design decision, not a runtime connection.

## 3. Launch and Lifecycle

- The Android application opens directly to Market Stall Standalone Lab.
- A simulation session starts automatically after required local state is loaded.
- A previous session resumes automatically when valid persisted state exists.
- Closing or backgrounding the app writes an atomic local checkpoint.
- Returning from the background advances no time unless an explicit offline-simulation option is added in a later version.
- Android Back closes an open dialog or terminal overlay first. At the base screen it requires a second press to exit.

## 4. Authoritative Simulation

`LivingMarket` is the only authority for actors, stalls, time, inventory, currency, needs, intentions, travel, transactions, and warnings.

The visible world, terminal, exports, and persistence all consume snapshots or events produced by that same state. No second NPC list, second stall ledger, decorative economy, or parallel simulation may exist.

### Required actor behavior

Actors must visibly and observably:

- form an intent with a machine-readable reason;
- travel between mapped locations over time rather than teleporting in the rendered view;
- open, staff, and close work according to schedules;
- source stock when storage falls below a target;
- transfer stock from storage to display;
- evaluate price, funds, need, and availability before purchasing;
- record successful and failed purchases with reasons;
- consume applicable goods and reduce the corresponding need;
- return home and rest;
- retain inventory, currency, needs, obligations, relationships, and current intent through checkpoints.

Travel is authoritative state, not a derived event label. Each traveling actor persists `locationId`, `destinationId`, `routeId`, ordered path nodes, progress, departure game time, and expected arrival game time. The renderer interpolates coordinates exclusively from this state. Follow mode uses the same interpolated coordinates.

### Required stall behavior

Each stall owns its storage, display inventory, till, prices, operator, open state, sales, failed sales, and pressure warnings. What the terminal reports must be the same values that drive visible stall activity.

### Time model

- Default speed: `1×`.
- Operator speeds: `1×`, `2×`, and `4×`.
- Operator may pause, resume, or step exactly one game hour.
- The UI displays game day, clock time, speed, seed, and session ID.
- The exact real-time-to-game-time ratio is configured in one place and included in every export.
- Simulation advancement uses bounded fixed steps so changing render frame rate does not change results.
- Speed changes only how quickly fixed steps are consumed. It never changes step size, decision frequency, or random-call order.

### Deterministic random state

The simulation owns a serializable `PCG32` random-number generator using 64-bit internal state and stream increment represented as hexadecimal strings at serialization boundaries. Checkpoints include the generator's complete current state, not only the original seed. A resumed session must make the same later random decisions as an uninterrupted session at the same canonical checkpoint.

Probability checks consume normalized 32-bit output. Selection from a bounded integer range uses rejection sampling and must not use raw low-order bits or `output % range`, which would introduce modulo bias. Automated tests cover known PCG32 reference vectors, serialize/resume equivalence, bounded-range validity, and a non-brittle distribution smoke check capable of detecting severe selection bias.

### Transactional state changes

Every simulation step is prepared against a candidate state. Invariants are validated before the candidate becomes authoritative. A failed candidate is discarded, the last valid state remains active, a diagnostic failure record is emitted outside the rejected transaction, and the scheduler pauses.

## 5. Display Modes

The application provides three modes without restarting the simulation:

1. **Split** — animated market and terminal visible together. This is the default.
2. **Market** — full-screen animated market with a compact status strip.
3. **Terminal** — full-screen diagnostics and reports.

Switching modes changes presentation only. It must not create, reset, pause, accelerate, or fork simulation state.

### Market view

- Shows every simulated actor at a position derived from its authoritative travel state.
- Shows stalls using authoritative open state, display stock, storage pressure, and activity.
- Observer may select an actor or stall directly.
- Follow mode moves the real rendered camera and remains attached to the selected entity.
- Pan cancels follow. Home restores the market overview.
- Zoom affects the real rendered camera.

### Terminal view

The terminal shows:

- chronological structured events;
- current actor location, destination, progress, intent, reason, needs, inventory, currency, and obligations;
- stall storage, display stock, till, operator, open state, pressure, and transaction totals;
- successful and failed transactions;
- simulation warnings and invariant failures;
- session metadata, configuration, seed, save status, and last checkpoint time.

Filters include actor, stall, event type, warning-only, and time range. Selecting a terminal entity selects the same entity in Market view.

## 6. Operator Controls

Available controls:

- Pause
- Resume
- Speed `1×`, `2×`, `4×`
- Step one game hour while paused
- Mark checkpoint
- Save now
- Export JSON
- Export TXT
- New Session
- Reset View

`New Session` requires confirmation and offers a final export before deleting the active session. It may reuse the current deterministic seed or accept a new numeric seed.

## 7. Persistence

Persistence uses a versioned standalone schema and dedicated Android WebView storage namespace.

A checkpoint contains:

- schema and build versions;
- session ID and deterministic seed;
- current serialized RNG state;
- simulation configuration and game time;
- actors and their full persistent state;
- stalls and their full persistent state;
- transaction ledger;
- journal cursor and checkpoint metadata;
- integrity checksum.

Loading validates structure, numeric ranges, entity references, and checksum before replacing live state. Invalid saves remain available for export and diagnosis but are not executed. The app starts a clean session only after clearly reporting the rejected checkpoint.

## 8. Real File Export

Exports are downloads/files, never clipboard codes.

### JSON export

Contains separate top-level sections for `checkpoint`, `journal`, `ledger`, `warnings`, `marks`, `configuration`, and `build`, plus the export timestamp. It must be sufficient to reproduce the deterministic session from its checkpoint and serialized RNG state.

### TXT export

Contains a human-readable session summary followed by timestamped events, actor summaries, stall summaries, transactions, warnings, and marked checkpoints.

Suggested filenames:

- `market-lab_<session-id>_day-<n>_<timestamp>.json`
- `market-lab_<session-id>_day-<n>_<timestamp>.txt`

On Android, export invokes the native file-save/share surface through a dedicated adapter. Browser downloads remain a fallback for desktop testing. Export success is reported only after the platform confirms a file operation.

## 9. Error Handling and Observability

- An invariant failure pauses simulation before additional state changes.
- The terminal displays the failed invariant, involved entity IDs, game time, and last valid checkpoint.
- Render failures do not advance or corrupt simulation state.
- Export failure preserves the report in memory for a retry.
- Persistence failure is visible in the status strip and terminal.
- Every build generates its fingerprint during the build. The on-screen fingerprint, persisted checkpoint, JSON/TXT exports, and compiled-APK audit must all contain the same generated value.

## 10. Android Identity and Packaging

- Application name: `Market Stall Lab`
- Application ID: `org.neocities.guildcraft.marketlab`
- Installs beside GuildCraft and previous public-facing builds.
- Landscape-first layout with immersive mode where supported.
- A dedicated GitHub Actions workflow builds and audits the standalone APK.
- The workflow rejects forbidden Portal/Trapline paths and clipboard APIs.
- The compiled APK is unpacked and audited before artifact upload.

## 11. Acceptance Tests

Passing unit tests alone is insufficient. Acceptance requires all of the following:

1. A deterministic seven-day simulation produces repeatable final state and event hashes for seed `25`.
2. A seven-day run interrupted by checkpoint, runtime destruction, reload, and continuation produces the same canonical final-state and event hashes as the uninterrupted seed-`25` run.
3. Every visible actor position corresponds to authoritative travel interpolation.
4. Observer pan, zoom, home, selection, and follow alter the real rendered camera.
5. A purchase changes the same stall display/till and actor currency/inventory shown on screen and in the terminal.
6. Pause prevents time advancement; step advances exactly one game hour; speed changes throughput without changing fixed-step state hashes.
7. An invalid candidate step leaves the prior canonical state unchanged, emits a diagnostic record, and pauses the scheduler.
8. Closing and reopening resumes the same session state and RNG state.
9. JSON and TXT exports produce nonempty real files containing the session ID and build-generated fingerprint.
10. The APK contains no Portal or Trapline runtime and no clipboard-code path.
11. The compiled APK launches directly, starts automatically, and displays the same fingerprint found in checkpoints and exports.
12. Market, Terminal, and Split modes share one continuously running simulation instance.

## 12. Explicit Non-Goals

This version does not include:

- player movement, combat, crafting interaction, or quests;
- Portal or Trapline navigation;
- multiplayer or network services;
- cloud synchronization;
- automatic promotion of experimental changes into GuildCraft;
- an editor for authoring new content;
- background/offline simulation while the app is closed.

## 13. Migration Strategy

The existing living-economy batch is evidence and reusable logic, not the new application architecture. Its deterministic rules may be extracted behind the authoritative simulation interface. Existing Market art and pure renderer utilities may be reused only after removing assumptions about global `player`, `npc.list`, `otherStalls`, Portal, and Trapline state.

The current standalone APK remains a baseline artifact. The rebuilt lab receives a new application ID and does not overwrite it during initial verification.
