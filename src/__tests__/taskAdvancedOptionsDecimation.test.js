import { describe, expect, it } from 'vitest';
import {
  estimateDecimationTarget,
  formatTriangleCount,
} from '../components/TaskAdvancedOptions.jsx';
import {
  PIPELINE_MESH_DECIMATION_MAX,
  PIPELINE_MESH_DECIMATION_TARGET,
  PIPELINE_MESH_SIMPLIFY_DEFAULT,
  clampPipelineDecimationTarget,
  getPipelineSafeMeshGenerationDefaults,
} from '../library/aiModelsCatalog.js';

describe('estimateDecimationTarget', () => {
  it('defaults onto the pipeline face budget (not TRELLIS 1M)', () => {
    expect(estimateDecimationTarget(PIPELINE_MESH_SIMPLIFY_DEFAULT, null, null)).toBe(
      PIPELINE_MESH_DECIMATION_TARGET,
    );
  });

  it('scales an existing target when the ratio changes', () => {
    expect(estimateDecimationTarget(0.5, 10000, 0.75)).toBe(6667);
  });

  it('clamps estimates to the pipeline max', () => {
    expect(estimateDecimationTarget(1, 1_000_000, 0.5)).toBe(PIPELINE_MESH_DECIMATION_MAX);
  });
});

describe('pipeline mesh budget defaults', () => {
  it('exposes defaults under the auto-rig upload budget', () => {
    const defaults = getPipelineSafeMeshGenerationDefaults();
    expect(defaults.mesh_simplify).toBe(PIPELINE_MESH_SIMPLIFY_DEFAULT);
    expect(defaults.model_parameters.decimation_target).toBe(PIPELINE_MESH_DECIMATION_TARGET);
    expect(defaults.model_parameters.decimation_target).toBeLessThanOrEqual(
      PIPELINE_MESH_DECIMATION_MAX,
    );
  });

  it('clampPipelineDecimationTarget caps API 1M defaults', () => {
    expect(clampPipelineDecimationTarget(1_000_000)).toBe(PIPELINE_MESH_DECIMATION_MAX);
    expect(clampPipelineDecimationTarget(null)).toBe(PIPELINE_MESH_DECIMATION_TARGET);
  });
});

describe('formatTriangleCount', () => {
  it('formats with grouping separators', () => {
    expect(formatTriangleCount(950000)).toBe((950000).toLocaleString());
  });
});
