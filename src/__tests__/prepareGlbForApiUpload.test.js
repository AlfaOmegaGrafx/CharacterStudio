import { describe, expect, it } from 'vitest';
import { Document, NodeIO } from '@gltf-transform/core';
import {
  computeApiUploadSimplifyRatio,
  prepareGlbForApiUpload,
} from '../library/glbCompress.js';

/** Build a dense triangle grid GLB (rows × cols quads). */
async function buildGridGlb(rows, cols) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const positions = [];
  const indices = [];
  for (let y = 0; y <= rows; y += 1) {
    for (let x = 0; x <= cols; x += 1) {
      positions.push(x, y, 0);
    }
  }
  const stride = cols + 1;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const a = y * stride + x;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const posAcc = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array(positions))
    .setBuffer(buffer);
  const idxAcc = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Uint32Array(indices))
    .setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute('POSITION', posAcc).setIndices(idxAcc);
  const mesh = doc.createMesh().addPrimitive(prim);
  doc.createNode().setMesh(mesh);
  doc.createScene().addChild(doc.getRoot().listNodes()[0]);
  const io = new NodeIO();
  const bytes = await io.writeBinary(doc);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe('computeApiUploadSimplifyRatio', () => {
  it('returns 1 when already under limits', () => {
    expect(computeApiUploadSimplifyRatio(1000, 2000, 210000, 210000)).toBe(1);
  });

  it('is driven by the tighter of verts vs faces (Dragon Knight-scale)', () => {
    const ratio = computeApiUploadSimplifyRatio(803693, 934718, 210000, 210000);
    const headroom = 0.85;
    expect(ratio).toBeCloseTo((210000 * headroom) / 934718, 4);
    expect(ratio).toBeLessThan(0.25);
  });

  it('retargets when verts remain over cap after triangle simplify', () => {
    // Faces under cap but verts still high (observed after first pass on Dragon Knight).
    const ratio = computeApiUploadSimplifyRatio(277290, 205990, 210000, 210000);
    const headroom = 0.85;
    expect(ratio).toBeCloseTo((210000 * headroom) / 277290, 3);
    expect(ratio).toBeLessThan(0.75);
  });
});

describe('prepareGlbForApiUpload', () => {
  it('passes through meshes already under the limit', async () => {
    const buffer = await buildGridGlb(4, 4);
    const result = await prepareGlbForApiUpload(buffer, {
      maxVertices: 210000,
      maxFaces: 210000,
    });
    expect(result.stats.decimated).toBe(false);
    expect(result.buffer).toBe(buffer);
  });

  it('decimates dense meshes under a low vertex/face cap', async () => {
    // 40×40 quads → 41² = 1681 verts, 3200 tris — over a 500/500 cap
    const buffer = await buildGridGlb(40, 40);
    const result = await prepareGlbForApiUpload(buffer, {
      maxVertices: 500,
      maxFaces: 500,
    });
    expect(result.stats.decimated).toBe(true);
    expect(result.stats.sourceVerts).toBeGreaterThan(500);
    expect(result.stats.verts).toBeLessThanOrEqual(500);
    expect(result.stats.tris).toBeLessThanOrEqual(500);
    expect(result.buffer.byteLength).toBeGreaterThan(0);
  }, 60000);
});
