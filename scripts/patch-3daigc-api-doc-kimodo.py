#!/usr/bin/env python3
"""Patch 3DAIGC-API docs/api_documentation.md for text_to_motion + OpenNexus naming."""
from pathlib import Path

DOC = Path("/home/sifr/3DAIGC-API/docs/api_documentation.md")
text = DOC.read_text(encoding="utf-8")

MOTION_BLOCK = """
## Text-to-Motion Endpoints (Kimodo)

Generates **studio motion JSON** from a natural-language prompt for playback in **OpenNexus3DStudio** (VRM or rigged GLB via `KimodoMotionPromptBar` → `kimodoMotionLoader.js`).

**Model:** `kimodo_text_to_motion` (Kimodo-SOMA-RP-v1.1 only — see `docs/MODEL_LICENSES.md`).

### Text to Motion
- **URL**: `/api/v1/text-to-motion/generate`
- **Method**: `POST`
- **Description**: Text prompt → SOMA motion → `studio_motion.json` (and optional NPZ/BVH assets on job download)
- **Authentication**: Required if user_auth_enabled is true
- **Request Body**:
```json
{
  "prompt": "walking forward naturally",
  "model_preference": "kimodo_text_to_motion",
  "duration_sec": 4
}
```
- **Response**:
```json
{
  "job_id": "job_123456",
  "status": "queued",
  "message": "Text-to-motion job queued successfully"
}
```

Poll with `GET /api/v1/jobs/{job_id}`; download motion via `GET /jobs/{job_id}/download?asset=studio_motion` (exact asset keys per job result).

Ops runbook: `memory-bank/kimodo-text-to-motion-ops.md` on DGX.

---

"""

if "Text-to-Motion Endpoints" not in text:
    marker = "## Splat Generation Endpoints"
    if marker not in text:
        raise SystemExit(f"marker not found: {marker}")
    text = text.replace(marker, MOTION_BLOCK + marker, 1)

text = text.replace(
    '"image_mesh_editing": ["voxhammer_image_mesh_editing"]\n  },\n  "total_features": 13,\n  "total_models": 22',
    '"image_mesh_editing": ["voxhammer_image_mesh_editing"],\n    "text_to_motion": ["kimodo_text_to_motion"]\n  },\n  "total_features": 14,\n  "total_models": 23',
)

if "| Text to Motion |" not in text:
    text = text.replace(
        "| Image Mesh Editing | `voxhammer_image_mesh_editing` | VoxHammer image mesh edit |\n",
        "| Image Mesh Editing | `voxhammer_image_mesh_editing` | VoxHammer image mesh edit |\n"
        "| Text to Motion | `kimodo_text_to_motion` | Kimodo SOMA → studio_motion.json for OpenNexus3DStudio |\n",
    )

text = text.replace(
    "including mesh generation, texturing, segmentation, and auto-rigging.",
    "including mesh generation, texturing, segmentation, auto-rigging, and text-to-motion (Kimodo).",
)

DOC.write_text(text, encoding="utf-8")
print("patched", DOC)
