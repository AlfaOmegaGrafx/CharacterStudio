/**
 * Viewport model geometry stats (object-scoped, not whole-scene renderer.info).
 *
 * Triangles / draw calls are derived from the loaded model graph so overlays,
 * lights, and helpers are excluded. Multi-material meshes count as multiple
 * draw calls (matches Three.js Mesh with material[]).
 */

/**
 * @param {import('three').BufferGeometry | null | undefined} geometry
 * @returns {number}
 */
export function countGeometryTriangles(geometry) {
  if (!geometry) return 0;

  const index = geometry.index;
  if (index && typeof index.count === 'number' && index.count > 0) {
    return Math.floor(index.count / 3);
  }

  const position = geometry.getAttribute?.('position') || geometry.attributes?.position;
  if (position && typeof position.count === 'number' && position.count > 0) {
    return Math.floor(position.count / 3);
  }

  return 0;
}

/**
 * @param {import('three').Material | import('three').Material[] | null | undefined} material
 * @returns {number}
 */
export function countMaterialDrawCalls(material) {
  if (!material) return 1;
  if (Array.isArray(material)) {
    return Math.max(1, material.filter(Boolean).length);
  }
  return 1;
}

/**
 * @param {import('three').Object3D | null | undefined} root
 * @returns {{ triangles: number, drawCalls: number, meshes: number }}
 */
export function countModelRenderStats(root) {
  if (!root || typeof root.traverse !== 'function') {
    return { triangles: 0, drawCalls: 0, meshes: 0 };
  }

  let triangles = 0;
  let drawCalls = 0;
  let meshes = 0;

  root.traverse((obj) => {
    if (!obj || obj.visible === false) return;
    if (!obj.isMesh && !obj.isSkinnedMesh && !obj.isInstancedMesh) return;

    // Skip non-geometry helpers sometimes tagged as Mesh
    if (obj.isBone || obj.isLight || obj.isCamera) return;

    const geomTriangles = countGeometryTriangles(obj.geometry);
    const instanceCount =
      obj.isInstancedMesh && typeof obj.count === 'number' && obj.count > 0
        ? obj.count
        : 1;

    triangles += geomTriangles * instanceCount;
    drawCalls += countMaterialDrawCalls(obj.material);
    meshes += 1;
  });

  return { triangles, drawCalls, meshes };
}
