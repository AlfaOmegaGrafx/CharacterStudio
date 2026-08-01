import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  countGeometryTriangles,
  countMaterialDrawCalls,
  countModelRenderStats,
} from '../library/viewportModelStats';

describe('viewportModelStats', () => {
  it('counts indexed BufferGeometry triangles', () => {
    const geom = new THREE.BoxGeometry(1, 1, 1);
    // BoxGeometry is indexed; 12 triangles
    expect(countGeometryTriangles(geom)).toBe(12);
  });

  it('counts non-indexed position attributes', () => {
    const geom = new THREE.BufferGeometry();
    // 9 triangles × 3 verts × 3 floats
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(9 * 3 * 3), 3),
    );
    expect(countGeometryTriangles(geom)).toBe(9);
  });

  it('counts multi-material as multiple draw calls', () => {
    expect(countMaterialDrawCalls(new THREE.MeshBasicMaterial())).toBe(1);
    expect(
      countMaterialDrawCalls([
        new THREE.MeshBasicMaterial(),
        new THREE.MeshBasicMaterial(),
      ]),
    ).toBe(2);
  });

  it('scopes stats to the model root and skips invisible meshes', () => {
    const root = new THREE.Group();
    const visible = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );
    const hidden = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );
    hidden.visible = false;
    root.add(visible, hidden);

    const sceneExtra = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );

    const stats = countModelRenderStats(root);
    expect(stats.meshes).toBe(1);
    expect(stats.triangles).toBe(12);
    expect(stats.drawCalls).toBe(1);

    // Sibling outside root must not be counted
    expect(countModelRenderStats(root).triangles).toBe(
      countModelRenderStats(root).triangles,
    );
    expect(countModelRenderStats(sceneExtra).triangles).toBe(12);
  });

  it('returns zeros for null root', () => {
    expect(countModelRenderStats(null)).toEqual({
      triangles: 0,
      drawCalls: 0,
      meshes: 0,
    });
  });
});
