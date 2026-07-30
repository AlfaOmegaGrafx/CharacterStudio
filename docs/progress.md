# Progress

**Updated:** 2026-07-30

## What works

- **OpenNexus3DStudio rebrand** + spatial fabric **Publish RP1** (Task Manager, user-confirmed 2026-06-19).
- **Incremental DGX ↔ Surface sync** — `sync-changes-to-dgx.ps1`, `sync-changes-to-pc.sh`, retry-until-complete.
- **Galaxy XR on main `/`** — grab (trigger), context menu / pan (grip), locomotion; `sceneManagerXrMouseEmulation.js`.
- **Image-to-world** — load + rehydrate (`dgx-rehydrate-world-job.py`) when Redis TTL expires; disk outputs persist on DGX.
- **World Library** — splat worlds in viewport; RP1 publishes manifest mesh props; task persistence for world jobs.
- **LingBot Environment Scan** (Jul 2026) — walk video → gravity-aligned world; Phase A isotropic Spark Gaussians; Phase B `/train-3dgs` (7–10k, densify off); floor RANSAC + wall-vs-camera fallback; door metric `0.762` m; Task Manager mm-precision true-length field.
- **Phygital mock** — `/verify/:serialId`, `docs/PHYGITAL_*`, passport schema in `src/library/phygital/`.
- VRM upload passthrough protected; app chrome layout protected.
- DGX **3DAIGC-API** `:7842` with `/api/v1/spatial-fabric/*` after restart + `.env` MSF vars.

## Moat documentation (2026-07-30)

- **MONETIZATION_ROADMAP.md** v3.3.7 (local only, gitignored) — LingBot env-scan Phase A/B SKUs planned; Pitch Deck/ aligned when next deck pass runs.
- Internal: `memory-bank/spacetime-moat-strategy.md`
- Public overview: `docs/SPACETIME_MOAT_OVERVIEW.md`
- Dev topology: `docs/DEV_MACHINE_TOPOLOGY.md` (incremental sync cheat sheet)
- Env-scan API: `3DAIGC-API/docs/LINGBOT_MAP_ENVIRONMENT_SCAN.md`

## Not done (moat-critical)

- OMB publish x402 SKU + enterprise hosted-fabric packaging (roadmap § near-term)
- World Library RP1 for splat-only worlds (needs props in manifest)
- x402 on API before job queue
- x402 `world_env_scan_a` / `world_env_scan_b` (Phase A vs B + frame-budget upsell)
- Live passport registry + SUN validation
- Wallet/x402 UI wired
- §11 personalized import + API fields
