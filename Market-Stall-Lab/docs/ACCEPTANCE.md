# Market Stall Lab acceptance record

Status: **APPROVED**

## Scope

The Lab APK is an autonomous Market Stall laboratory. It has no Portal,
Trapline, playable Market, shared runtime, clipboard export, or front-facing
application ID dependency. The Android package ID is
`org.neocities.guildcraft.marketlab`.

## Deterministic baseline

- Seed: `25`
- Stream: `77`
- Session: `seed-25-acceptance`
- Checkpoint: minute `4320`
- Full run: minute `10080` (seven days)
- Frozen baseline fingerprint: `5eed25000001`
- State hash: `d53eaf0200be2ff05b546c599add10e310d42658255590eea2a662c1055299c8`
- Event hash: `1d17631d898749ff266a1708f9447ea5549847450f2c1efadb69112f83ccd855`
- Event count: `23202`
- Ledger entries: `12`; total: `60`
- Warnings: `0`

The uninterrupted seven-day run and the checkpoint-resumed run produce the
same canonical state and event hashes.

## Verification

Local and CI acceptance command:

```text
npm test
```

Result: **30 tests passed, 0 failed**.

The GitHub Actions job additionally passed web packaging, Capacitor sync,
Java 21 Gradle compilation, and the APK boundary audit.

## Build evidence

- Branch: `market-stall-lab`
- Commit: `bdedf3fada394af914692b8bbefa40831d4b9a48`
- Workflow run: https://github.com/Stratumnova/GuildCraft-Android/actions/runs/35145531243
- Artifact: `Market-Stall-Lab-debug-apk`
- Artifact ID: `10467596178`
- Artifact digest: `sha256:3331754ff47152353fde102abe22db10b4298a7819c60d2b727a2bf508f89df5`

## Evidence exports

The Lab's native file adapter exports `market-lab-report.json` and
`market-lab-report.txt`. Both exports identify the same build fingerprint and
keep checkpoint state, journal, ledger, marks, warnings, configuration, and
build metadata in separate sections.
