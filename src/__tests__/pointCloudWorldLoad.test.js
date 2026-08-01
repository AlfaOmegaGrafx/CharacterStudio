import { describe, expect, it } from 'vitest';
import {
  isAsciiPointCloudPlyHeader,
  parseAsciiXyzRgbPly,
} from '../library/pointCloudPlyLoader.js';
import { parseWorldPackage } from '../library/worldPackage.js';
import { shouldLoadEnvironmentAsPointCloud } from '../library/worldSceneLoader.js';
import { resolveTaskModelUrl, DEV_DGX_PROXY_PREFIX } from '../library/taskModelUrl.js';

describe('pointCloudPlyLoader', () => {
  const sample = `ply
format ascii 1.0
element vertex 2
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
end_header
0 1 2 255 0 0
3 4 5 0 255 0
`;

  it('detects ascii xyzrgb headers', () => {
    expect(isAsciiPointCloudPlyHeader(sample)).toBe(true);
    expect(isAsciiPointCloudPlyHeader('ply\nformat binary_little_endian 1.0\nproperty float f_dc_0')).toBe(
      false,
    );
  });

  it('parses ascii colored vertices', () => {
    const { count, positions, colors } = parseAsciiXyzRgbPly(sample);
    expect(count).toBe(2);
    expect(positions[0]).toBe(0);
    expect(positions[1]).toBe(1);
    expect(colors[0]).toBeCloseTo(1);
    expect(colors[4]).toBeCloseTo(1);
  });
});

describe('point cloud world routing', () => {
  it('parseWorldPackage keeps point_cloud type', () => {
    const m = parseWorldPackage({
      id: 'office',
      environment: { type: 'point_cloud', url: 'environment.ply', renderer: 'points' },
      metadata: { pipeline: 'lingbot_map_environment_scan', source_geometry: 'point_cloud' },
    });
    expect(m.environment.type).toBe('point_cloud');
    expect(m.environment.renderer).toBe('points');
    expect(shouldLoadEnvironmentAsPointCloud(m)).toBe(true);
  });

  it('routes LingBot Phase A gaussian worlds to Spark, not XYZRGB point parser', () => {
    const m = parseWorldPackage({
      id: 'office-3dgs',
      environment: {
        type: 'gaussian_splat',
        url: 'environment.ply',
        renderer: 'spark',
      },
      metadata: {
        pipeline: 'lingbot_map_environment_scan',
        source_geometry: 'gaussian_from_point_cloud',
        gaussian_phase: 'A_isotropic_from_points',
      },
    });
    expect(m.environment.type).toBe('gaussian_splat');
    expect(shouldLoadEnvironmentAsPointCloud(m)).toBe(false);
  });

  it('routes LingBot Phase B gsplat worlds to Spark (not points)', () => {
    const m = parseWorldPackage({
      id: 'office-3dgs-b',
      environment: {
        type: 'gaussian_splat',
        url: 'environment.ply',
        renderer: 'spark',
      },
      metadata: {
        pipeline: 'lingbot_map_environment_scan',
        source_geometry: 'gaussian_from_point_cloud',
        gaussian_phase: 'B_gsplat_trained',
        gravity_align: { method: 'floor_ransac+y_flip+x_mirror' },
      },
    });
    expect(shouldLoadEnvironmentAsPointCloud(m)).toBe(false);
  });

  it('does not double-prefix __dev_dgx_proxy', () => {
    const once = resolveTaskModelUrl('/api/v1/system/jobs/x/download?asset=manifest', DEV_DGX_PROXY_PREFIX);
    expect(once).toBe(`${DEV_DGX_PROXY_PREFIX}/api/v1/system/jobs/x/download?asset=manifest`);
    const twice = resolveTaskModelUrl(once, DEV_DGX_PROXY_PREFIX);
    expect(twice).toBe(once);
  });
});
