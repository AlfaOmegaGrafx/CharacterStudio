# Avatar pipeline (OpenNexus3DStudio)

## Quick path

1. Connect to **3DAIGC-API** (DGX)  
2. Task: **Avatar from Image (TRELLIS to VRM)**  
3. Upload photo → wait for TRELLIS to VRM  
4. Viewport loads rigged GLB  
5. Optional: **Download VRM after pipeline** → browser saves `*.vrm`  

## What “VRM export from rigged GLB” means

**Yes — it downloads a file.** The API returns a rigged **GLB**. OpenNexus3DStudio’s existing `VRMExporter` (Save panel or post-pipeline hook) builds a **`.vrm`** blob and triggers a **browser download**. Nothing is uploaded unless you Mint/save elsewhere.

Flow:

```
Photo → API (TRELLIS) → GLB
     → API (template rig) → rigged GLB
     → load in viewport
     → exportAvatarPipelineVrm() → user downloads avatar.vrm
```

Template **expression names** can be embedded in VRM meta; **mesh morphs** require wrap (see API `MESH_WRAP_ROADMAP.md`).

## Task types

| Task | API | Viewport |
|------|-----|----------|
| Image to 3D | mesh-generation | GLB mesh |
| Auto Rigging → Template VRM | auto-rigging `rig_mode: template` | Rigged GLB |
| Avatar from Image | TRELLIS to VRM | Rigged GLB + optional VRM download |
| Image to Gaussian Splat | splat-generation | Spark `SplatMesh` |
| Avatar from Image + splat checkbox | above + TripoSplat parallel | Body GLB + splat preview |

## Rig alignment & contract

API export is validated against [API_AVATAR_RIG_CONTRACT.md](API_AVATAR_RIG_CONTRACT.md). After a new avatar-from-image job, grep remote log for `[API-Contract] PASS`.

If the rig was **backward** or **floating at hips**, re-run after pulling latest API. The Blender script aligns on **Z-up** (Blender's vertical after glTF import), not glTF Y.

- Feet (foot bones) aligned to mesh ground  
- Skeleton no longer inverted (head at top, feet at bottom)  
- OpenNexus3DStudio skips auto 180° re-orient and rig-repair heuristics for `fromAigc` loads  
- Client validates pre-process and post-viewport-layout (no client-side rig hacks)


## Blend shapes direction

| Source | Expressions |
|--------|-------------|
| Template morph head | ARKit morphs on template topology |
| `template_wrap` (Phase 5) | Same morphs on **stitched template head** + AIGC body |
| Bones-only `template` rig | Skeleton only on AIGC mesh (no face morphs) |
| [Arc2Avatar](https://arc2avatar.github.io/) | FLAME on head **splats** (same wrap track, `head_track: arc2avatar\|both`) |
| TripoSplat | Preview only, not rigged VRM |
| SkinTokens / creature_template | **No MeshMonk** — bone-level jaw/eye mapping when morph targets are absent (see `creatureFaceRetarget.js`) |

## Humanoid head track (same task as GNM / MeshMonk)

Body+Cloth / `template_wrap` uses one **head track** with engine chips (`head_track`):

| Chip | Engine |
|------|--------|
| **GNM + MeshMonk** | Ethnicity → GNM identity; AIGC face → MeshMonk/RBF `face_likeness` on template morph head (XR blendshapes) |
| **Arc2Avatar** | Selfie → SDS head `.ply` attached to Head bone (photoreal splat) |
| **Both** | MeshMonk/GNM warp **and** Arc2Avatar overlay |

XR face tracking stays on the template morph head; Arc2Avatar is the photoreal overlay.

## Studio: Body+Cloth (head track)

OpenNexus Studio template **`krea_composable_avatar_body`** (UI: Body+Cloth):

1. **Head track** — Image options chips (GNM+MeshMonk / Arc2Avatar / Both). Selfie required when Arc2Avatar is selected.
2. **Body** — text prompt → Krea neck-open → TRELLIS.2 → `template_wrap`.
3. **Clothing** — Appearance slots via `parseClothingAccessoryLines` with smart layering (full-body pajamas replace Chest/Legs/Waist; boxing gloves exclude wristwear; Head/Hands/Neck smart segmentation stacks compatible accessories e.g. baseball cap + glasses). Culling layers **0 / 1 / 2** — see [Appearance](docs/Developers/Pages/appearance.md) and [Modder Culling Layers](docs/Modders/getting-started.md#culling-layers).
4. **Compose** — Arc2Avatar PLY parents to Head bone when SDS finishes (`attachHeadSplatToBody`).

Selfie is never the body image. Task Manager “Avatar head (Arc2Avatar)” is a shortcut into the same track.

See `HEAD_TRACK` in `avatarPipelineCatalog.js`, API `MESH_WRAP_ROADMAP.md` + `ARC2AVATAR_TRACK.md`.

## Uploaded VRM (not AIGC)

User-uploaded `.vrm` files use a **separate** path from rigged GLBs. See [VRM_UPLOAD_DISPLAY_EXPORT.md](VRM_UPLOAD_DISPLAY_EXPORT.md) (scene-root transforms, multi-skin rebind, skeleton viz, export round-trip).

## VRM drag-drop metadata

`CombinedImport` + `vrmTemplateMetadata.js`:

- Drag `.vrm` → parse extensions (`VRM` / `VRMC_vrm`)  
- Store presets in `sessionStorage`  
- Optional pairing with splat preview URL (`attachSplatPreviewMetadata`)  

## Key files

| File | Role |
|------|------|
| `src/library/avatarPipelineCatalog.js` | Template id, rig modes |
| `src/library/taskManager.js` | `executeAvatarFromImage`, template rig API |
| `src/library/avatarPipelineExport.js` | Post-pipeline VRM **download** |
| `src/library/vrmTemplateMetadata.js` | VRM file parse + splat pairing |
| `src/library/sparkSplatManager.js` | Spark.js splats |
| `src/components/TaskManager.jsx` | UI tasks + export checkbox |

## Tests

```bash
node node_modules/vitest/vitest.mjs run src/__tests__/avatarPipelineCatalog.test.js src/__tests__/taskManagerTemplateRig.test.js
```
