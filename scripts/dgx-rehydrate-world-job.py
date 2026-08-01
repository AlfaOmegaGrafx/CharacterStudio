#!/usr/bin/env python3
"""Re-register a completed world job in Redis from on-disk outputs.

Use when 3DAIGC-API returns 404 for a job whose files still exist under
outputs/worlds/{job_id}/ (common after Redis TTL ~24h or API restart).

Run on DGX (use 3DAIGC-API venv — system python may lack redis):
  /home/sifr/3DAIGC-API/venv/bin/python \\
    /home/sifr/OpenNexus3DStudio/scripts/dgx-rehydrate-world-job.py <job_id>
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import redis
except ImportError:
    print("Install redis: pip install redis", file=sys.stderr)
    sys.exit(1)

ROOT = Path(os.environ.get("P3D_API_ROOT", "/home/sifr/3DAIGC-API"))
WORLDS = ROOT / "outputs" / "worlds"
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
QUEUE_PREFIX = os.environ.get("P3D_QUEUE_PREFIX", "3daigc")


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: dgx-rehydrate-world-job.py <job_id>", file=sys.stderr)
        return 1

    job_id = sys.argv[1].strip()
    world_dir = (WORLDS / job_id).resolve()
    manifest_path = world_dir / "world.manifest.json"
    env_ply = world_dir / "environment.ply"

    if not manifest_path.is_file():
        print(f"Missing {manifest_path}", file=sys.stderr)
        return 1
    if not env_ply.is_file():
        print(f"Missing {env_ply}", file=sys.stderr)
        return 1

    with manifest_path.open(encoding="utf-8") as f:
        manifest = json.load(f)

    meta = manifest.get("metadata") or {}
    pipeline = str(meta.get("pipeline") or "")
    is_scan = "lingbot" in pipeline or meta.get("source_geometry") == "point_cloud"
    feature = "environment_scan" if is_scan else "image_to_world"

    result = {
        "success": True,
        "feature": feature,
        "pipeline": pipeline or feature,
        "world_directory": str(world_dir),
        "world_manifest_path": str(manifest_path),
        "world_manifest_url": f"/api/v1/system/jobs/{job_id}/download?asset=manifest",
        "world_base_url": f"/api/v1/system/jobs/{job_id}/world/",
        "output_splat_path": str(env_ply),
        "output_mesh_path": str(env_ply),
        "mesh_url": f"/api/v1/system/jobs/{job_id}/download",
        "prop_count": len(manifest.get("props") or []),
        "generation_info": {
            "pipeline": pipeline or feature,
            **{k: meta.get(k) for k in ("source_geometry", "point_count", "metric_calibration") if k in meta},
        },
    }

    now = datetime.now(timezone.utc).isoformat()
    job_data = {
        "job_id": job_id,
        "feature": feature,
        "inputs": json.dumps({"world_name": manifest.get("name") or job_id}),
        "model_preference": "lingbot_map_environment_scan" if is_scan else "",
        "priority": 0,
        "status": "completed",
        "created_at": meta.get("created_at") or now,
        "completed_at": now,
        "metadata": json.dumps({"rehydrated": True}),
        "user_id": "",
    }

    r = redis.from_url(REDIS_URL, decode_responses=True)
    jobs_key = f"{QUEUE_PREFIX}:jobs"
    results_key = f"{QUEUE_PREFIX}:results"
    r.hset(jobs_key, job_id, json.dumps(job_data))
    r.hset(results_key, job_id, json.dumps(result))

    print(f"Rehydrated job {job_id} in Redis")
    print(f"  feature: {feature}")
    print(f"  world_directory: {world_dir}")
    print(f"  manifest: {manifest_path}")
    print(
        f"  verify: curl -sS -o /dev/null -w '%{{http_code}}' "
        f"http://127.0.0.1:7842/api/v1/system/jobs/{job_id}/world/environment.ply"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
