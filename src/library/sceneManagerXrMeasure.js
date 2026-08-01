/**
 * In-headset AR measuring stick — two-point distance using WebXR tracking.
 * Axis-locks to world horizontal or vertical using headset/world up.
 */
import * as THREE from './three.js';

export const XR_MEASURE_AXIS_HORIZONTAL = 'horizontal';
export const XR_MEASURE_AXIS_VERTICAL = 'vertical';
export const XR_MEASURE_UNIT_METERS = 'm';
export const XR_MEASURE_UNIT_FEET = 'ft';
export const XR_MEASURE_UNIT_INCHES = 'in';

const _tmp = new THREE.Vector3();
const _start = new THREE.Vector3();
const _end = new THREE.Vector3();

/**
 * @param {number} meters
 * @param {'m'|'ft'|'in'} unit
 */
export function formatMeasureLength(meters, unit = XR_MEASURE_UNIT_METERS) {
  const m = Number(meters);
  if (!Number.isFinite(m)) return '—';
  if (unit === XR_MEASURE_UNIT_FEET) return `${(m * 3.280839895).toFixed(2)} ft`;
  if (unit === XR_MEASURE_UNIT_INCHES) return `${(m * 39.37007874).toFixed(1)} in`;
  return `${m.toFixed(3)} m`;
}

/**
 * Project end so the segment is purely horizontal or vertical in world space.
 * @param {THREE.Vector3} start
 * @param {THREE.Vector3} end
 * @param {'horizontal'|'vertical'} axis
 */
export function lockMeasureAxis(start, end, axis) {
  _end.copy(end);
  if (axis === XR_MEASURE_AXIS_VERTICAL) {
    _end.x = start.x;
    _end.z = start.z;
  } else {
    _end.y = start.y;
  }
  return _end.clone();
}

export class SceneManagerXrMeasure {
  /**
   * @param {import('./sceneManager.js').SceneManager} sceneManager
   */
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.active = false;
    this.axis = XR_MEASURE_AXIS_HORIZONTAL;
    this.unit = XR_MEASURE_UNIT_METERS;
    /** @type {THREE.Vector3|null} */
    this.start = null;
    /** @type {THREE.Vector3|null} */
    this.end = null;
    /** Last completed length in meters (for environment-scan calibration). */
    this.lastMeters = null;
    this._line = null;
    this._markers = [];
  }

  reset() {
    this.active = false;
    this.start = null;
    this.end = null;
    this._clearVisuals();
  }

  toggleActive() {
    this.active = !this.active;
    if (!this.active) {
      this.start = null;
      this.end = null;
      this._clearVisuals();
    }
    return this.active;
  }

  cycleUnit() {
    const order = [
      XR_MEASURE_UNIT_METERS,
      XR_MEASURE_UNIT_FEET,
      XR_MEASURE_UNIT_INCHES,
    ];
    const i = order.indexOf(this.unit);
    this.unit = order[(i + 1) % order.length];
    return this.unit;
  }

  cycleAxis() {
    this.axis =
      this.axis === XR_MEASURE_AXIS_HORIZONTAL
        ? XR_MEASURE_AXIS_VERTICAL
        : XR_MEASURE_AXIS_HORIZONTAL;
    return this.axis;
  }

  statusLabel() {
    if (!this.active) return 'Measure: Off';
    if (this.start && !this.end) {
      return `Measure: set end (${this.axis === XR_MEASURE_AXIS_VERTICAL ? 'V' : 'H'})`;
    }
    if (this.lastMeters != null) {
      return `Measure: ${formatMeasureLength(this.lastMeters, this.unit)}`;
    }
    return `Measure: set start (${this.unit})`;
  }

  /**
   * Place start/end at a world hit (or along ray at fixed depth).
   * @param {THREE.Vector3} worldPoint
   */
  placePoint(worldPoint) {
    if (!this.active) return false;
    if (!this.start) {
      this.start = worldPoint.clone();
      this.end = null;
      this._ensureVisuals();
      this._updateVisuals(this.start, this.start);
      return true;
    }
    const locked = lockMeasureAxis(this.start, worldPoint, this.axis);
    this.end = locked;
    this.lastMeters = this.start.distanceTo(locked);
    this._updateVisuals(this.start, locked);
    this.sceneManager.emit?.('xrMeasureComplete', {
      meters: this.lastMeters,
      unit: this.unit,
      axis: this.axis,
      start: this.start.toArray(),
      end: locked.toArray(),
      true_meters: this.lastMeters,
    });
    // Ready for a new segment; keep lastMeters for calibration.
    this.start = null;
    this.end = null;
    return true;
  }

  /**
   * @param {import('./sceneManagerXrInput.js').XrPointerState[]} pointers
   */
  handlePointerSelect(pointers) {
    if (!this.active) return false;
    for (const pointer of pointers) {
      if (!pointer.selectStart) continue;
      _tmp
        .copy(pointer.rayOrigin)
        .addScaledVector(pointer.rayDirection.clone().normalize(), 1.2);
      if (this.placePoint(_tmp)) return true;
    }
    return false;
  }

  _ensureVisuals() {
    const scene = this.sceneManager?.scene;
    if (!scene || this._line) return;
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    this._line = new THREE.Line(
      geom,
      new THREE.LineBasicMaterial({ color: 0x44ffaa, depthWrite: true }),
    );
    this._line.name = 'XRMeasureLine';
    this._line.renderOrder = 999;
    scene.add(this._line);
    for (let i = 0; i < 2; i += 1) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x44ffaa, depthWrite: true }),
      );
      m.name = `XRMeasureMarker_${i}`;
      m.renderOrder = 999;
      scene.add(m);
      this._markers.push(m);
    }
  }

  /**
   * @param {THREE.Vector3} a
   * @param {THREE.Vector3} b
   */
  _updateVisuals(a, b) {
    this._ensureVisuals();
    if (!this._line) return;
    _start.copy(a);
    _end.copy(b);
    const pos = this._line.geometry.attributes.position;
    pos.setXYZ(0, _start.x, _start.y, _start.z);
    pos.setXYZ(1, _end.x, _end.y, _end.z);
    pos.needsUpdate = true;
    this._line.geometry.computeBoundingSphere();
    this._line.visible = true;
    if (this._markers[0]) {
      this._markers[0].position.copy(_start);
      this._markers[0].visible = true;
    }
    if (this._markers[1]) {
      this._markers[1].position.copy(_end);
      this._markers[1].visible = true;
    }
  }

  _clearVisuals() {
    if (this._line) {
      this._line.parent?.remove(this._line);
      this._line.geometry?.dispose?.();
      this._line.material?.dispose?.();
      this._line = null;
    }
    for (const m of this._markers) {
      m.parent?.remove(m);
      m.geometry?.dispose?.();
      m.material?.dispose?.();
    }
    this._markers = [];
  }
}
