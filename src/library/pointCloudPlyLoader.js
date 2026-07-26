/**
 * Load XYZ(+RGB) point-cloud PLY (ASCII or binary_little_endian) into THREE.Points.
 * Used for LingBot-Map environment scans (not Gaussian splat PLYs).
 */
import * as THREE from './three.js';

const MAX_POINTS = 750_000;

/**
 * @param {string} headerText
 */
export function isAsciiPointCloudPlyHeader(headerText) {
  const head = String(headerText || '').slice(0, 2048).toLowerCase();
  if (!head.includes('ply')) return false;
  if (head.includes('f_dc_0') || head.includes('scale_0') || head.includes('opacity')) {
    return false;
  }
  const hasXyz = head.includes('property float x') && head.includes('property float y');
  const hasRgb = head.includes('property uchar red') || head.includes('property float red');
  if (!hasXyz) return false;
  if (head.includes('format ascii')) return true;
  if (head.includes('format binary_little_endian') && hasRgb) return true;
  return hasRgb;
}

/**
 * @param {string} text
 * @returns {{ positions: Float32Array, colors: Float32Array, count: number }}
 */
export function parseAsciiXyzRgbPly(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  let vertexCount = 0;
  const props = [];
  while (i < lines.length) {
    const line = lines[i].trim();
    i += 1;
    if (line.startsWith('element vertex')) {
      vertexCount = Number(line.split(/\s+/)[2]) || 0;
    } else if (line.startsWith('property')) {
      const parts = line.split(/\s+/);
      props.push(parts[parts.length - 1]);
    } else if (line === 'end_header') {
      break;
    }
  }
  if (!vertexCount) {
    throw new Error('PLY missing element vertex count');
  }

  const ix = props.indexOf('x');
  const iy = props.indexOf('y');
  const iz = props.indexOf('z');
  if (ix < 0 || iy < 0 || iz < 0) {
    throw new Error('PLY missing x/y/z properties');
  }
  const ir = props.indexOf('red');
  const ig = props.indexOf('green');
  const ib = props.indexOf('blue');

  const stride = Math.max(1, Math.ceil(vertexCount / MAX_POINTS));
  const outCount = Math.ceil(vertexCount / stride);
  const positions = new Float32Array(outCount * 3);
  const colors = new Float32Array(outCount * 3);

  let written = 0;
  let row = 0;
  while (i < lines.length && row < vertexCount) {
    const line = lines[i].trim();
    i += 1;
    if (!line) continue;
    if (row % stride === 0) {
      const parts = line.split(/\s+/);
      const o = written * 3;
      positions[o] = Number(parts[ix]) || 0;
      positions[o + 1] = Number(parts[iy]) || 0;
      positions[o + 2] = Number(parts[iz]) || 0;
      if (ir >= 0 && ig >= 0 && ib >= 0 && parts.length > Math.max(ir, ig, ib)) {
        colors[o] = (Number(parts[ir]) || 0) / 255;
        colors[o + 1] = (Number(parts[ig]) || 0) / 255;
        colors[o + 2] = (Number(parts[ib]) || 0) / 255;
      } else {
        colors[o] = 0.75;
        colors[o + 1] = 0.78;
        colors[o + 2] = 0.85;
      }
      written += 1;
    }
    row += 1;
  }

  return {
    positions: positions.subarray(0, written * 3),
    colors: colors.subarray(0, written * 3),
    count: written,
  };
}

/**
 * Binary little-endian: float x y z + uchar r g b (packed, no padding).
 * @param {ArrayBuffer} buffer
 * @param {number} headerEnd
 * @param {number} vertexCount
 */
export function parseBinaryXyzRgbPly(buffer, headerEnd, vertexCount) {
  const strideBytes = 15; // 3*float32 + 3*uint8
  const body = new DataView(buffer, headerEnd);
  const available = Math.floor((buffer.byteLength - headerEnd) / strideBytes);
  const n = Math.min(vertexCount || available, available);
  const sampleStride = Math.max(1, Math.ceil(n / MAX_POINTS));
  const outCount = Math.ceil(n / sampleStride);
  const positions = new Float32Array(outCount * 3);
  const colors = new Float32Array(outCount * 3);
  let written = 0;
  for (let row = 0; row < n; row += sampleStride) {
    const off = row * strideBytes;
    const o = written * 3;
    positions[o] = body.getFloat32(off, true);
    positions[o + 1] = body.getFloat32(off + 4, true);
    positions[o + 2] = body.getFloat32(off + 8, true);
    colors[o] = body.getUint8(off + 12) / 255;
    colors[o + 1] = body.getUint8(off + 13) / 255;
    colors[o + 2] = body.getUint8(off + 14) / 255;
    written += 1;
  }
  return {
    positions: positions.subarray(0, written * 3),
    colors: colors.subarray(0, written * 3),
    count: written,
  };
}

/**
 * @param {ArrayBuffer} buffer
 */
function parsePlyBuffer(buffer) {
  const headBytes = Math.min(buffer.byteLength, 4096);
  const headText = new TextDecoder().decode(buffer.slice(0, headBytes));
  const endIdx = headText.indexOf('end_header');
  if (endIdx < 0) {
    throw new Error('PLY missing end_header');
  }
  const header = headText.slice(0, endIdx);
  const headerEnd = endIdx + 'end_header'.length;
  // Skip optional newline after end_header
  let dataStart = headerEnd;
  if (headText[headerEnd] === '\r') dataStart += 1;
  if (headText[dataStart] === '\n' || headText[headerEnd] === '\n') {
    dataStart = headerEnd + (headText[headerEnd] === '\r' ? 2 : 1);
  }

  let vertexCount = 0;
  for (const line of header.split(/\r?\n/)) {
    if (line.startsWith('element vertex')) {
      vertexCount = Number(line.split(/\s+/)[2]) || 0;
    }
  }

  const isBinary = /format\s+binary_little_endian/i.test(header);
  if (isBinary) {
    return parseBinaryXyzRgbPly(buffer, dataStart, vertexCount);
  }
  const text = new TextDecoder().decode(buffer);
  return parseAsciiXyzRgbPly(text);
}

/**
 * @param {string} url
 * @param {{ pointSize?: number }} [options]
 * @returns {Promise<THREE.Points>}
 */
export async function loadPointCloudPly(url, options = {}) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch point cloud (${res.status}): ${url}`);
  }
  const buffer = await res.arrayBuffer();
  const head = new TextDecoder().decode(buffer.slice(0, 1024));
  if (
    /f_dc_0|scale_0|property float opacity/i.test(head)
  ) {
    throw new Error(
      'Gaussian splat PLY passed to point-cloud loader — use Spark (renderer: spark)',
    );
  }
  if (!isAsciiPointCloudPlyHeader(head) && !/format\s+binary_little_endian/i.test(head)) {
    throw new Error('Not an XYZRGB point-cloud PLY');
  }
  const { positions, colors, count } = parsePlyBuffer(buffer);
  if (count < 10) {
    throw new Error(`Point cloud too small (${count} points)`);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: options.pointSize ?? 0.02,
    vertexColors: true,
    sizeAttenuation: true,
    depthWrite: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'WorldEnvironmentPointCloud';
  points.userData.isWorldEnvironment = true;
  points.userData.isPointCloud = true;
  points.userData.pointCount = count;
  console.log(`[World] Loaded point cloud: ${count} points from`, url);
  return points;
}

/**
 * @param {THREE.Object3D|null|undefined} obj
 */
export function disposePointCloud(obj) {
  if (!obj) return;
  obj.geometry?.dispose?.();
  if (Array.isArray(obj.material)) {
    obj.material.forEach((m) => m.dispose?.());
  } else {
    obj.material?.dispose?.();
  }
}
