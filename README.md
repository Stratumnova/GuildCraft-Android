# GuildCraft Android Builds

This repository stores versioned Android build inputs and their matching GitHub Actions workflows.

## Active front-facing uploads

- `uploads/front-facing/GuildCraft_FrontFacing_Android_v1.0_FULL.zip`
- `uploads/front-facing/GuildCraft_FrontFacing_Android_v2.0_UPLOAD.zip`
- `uploads/front-facing/GuildCraft_FrontFacing_Android_v3.0_UPLOAD.zip`

Each upload has a workflow with the same product type and version. A workflow runs only when its matching upload or workflow changes, or when manually dispatched.

## Market Stall Lab

The true autonomous laboratory is developed on the `market-stall-lab` branch under `Market-Stall-Lab/`. Its application ID is `org.neocities.guildcraft.marketlab`.

## Legacy

`uploads/legacy/Market_Stall_PortalCoupled_Legacy_v1.1.zip` is the retired Portal-coupled experiment. It is not the Market Stall Lab. Its workflow is manual-only and its artifact is labeled `LEGACY-DO-NOT-TEST`.

## Checkpoints

`uploads/checkpoints/Portal_Checkpoint_v1.0_CLEAN.zip` is a source checkpoint, not an Android application upload.
