/**
 * Shared viewport lighting defaults for OpenNexus3DStudio.
 *
 * Slider UI range is 0–2 (default 1.0). Applied Three.js intensity/exposure is
 * UI × 2, so UI 1.0 behaves like the old 2.0 and UI 2.0 like the old 4.0.
 * Exported GLB extras and MSF sidecars store the *effective* values so Assembler
 * / Metaverse Browser match the viewport look without knowing about UI scale.
 */

export const DEFAULT_VIEWPORT_LIGHT_INTENSITY = 1.0;
export const MAX_VIEWPORT_LIGHT_INTENSITY = 2.0;
export const MIN_VIEWPORT_LIGHT_INTENSITY = 0;
export const DEFAULT_VIEWPORT_EXPOSURE = 1.0;
export const MAX_VIEWPORT_EXPOSURE = 2.0;
export const MIN_VIEWPORT_EXPOSURE = 0;
/** UI slider value → Three.js / export intensity (1→2, 2→4). */
export const VIEWPORT_UI_TO_EFFECTIVE_SCALE = 2;
export const DEFAULT_VIEWPORT_LIGHTING_PRESET = 'soft';
export const DEFAULT_VIEWPORT_TONE_MAPPING = 'ACESFilmic';

export const VIEWPORT_LIGHTING_EXTRAS_KEY = 'opennexusViewportLighting';

export const DEFAULT_EFFECTIVE_LIGHT_INTENSITY =
  DEFAULT_VIEWPORT_LIGHT_INTENSITY * VIEWPORT_UI_TO_EFFECTIVE_SCALE;
export const MAX_EFFECTIVE_LIGHT_INTENSITY =
  MAX_VIEWPORT_LIGHT_INTENSITY * VIEWPORT_UI_TO_EFFECTIVE_SCALE;
export const DEFAULT_EFFECTIVE_EXPOSURE =
  DEFAULT_VIEWPORT_EXPOSURE * VIEWPORT_UI_TO_EFFECTIVE_SCALE;
export const MAX_EFFECTIVE_EXPOSURE =
  MAX_VIEWPORT_EXPOSURE * VIEWPORT_UI_TO_EFFECTIVE_SCALE;

/**
 * @param {unknown} value
 * @returns {number}
 */
export function clampViewportLightIntensity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_VIEWPORT_LIGHT_INTENSITY;
  return Math.min(
    MAX_VIEWPORT_LIGHT_INTENSITY,
    Math.max(MIN_VIEWPORT_LIGHT_INTENSITY, n),
  );
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function clampViewportExposure(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_VIEWPORT_EXPOSURE;
  return Math.min(MAX_VIEWPORT_EXPOSURE, Math.max(MIN_VIEWPORT_EXPOSURE, n));
}

/**
 * @param {unknown} ui
 * @returns {number}
 */
export function uiToEffectiveLightIntensity(ui) {
  return clampViewportLightIntensity(ui) * VIEWPORT_UI_TO_EFFECTIVE_SCALE;
}

/**
 * @param {unknown} ui
 * @returns {number}
 */
export function uiToEffectiveExposure(ui) {
  return clampViewportExposure(ui) * VIEWPORT_UI_TO_EFFECTIVE_SCALE;
}

/**
 * Clamp an already-effective intensity (0–4).
 * @param {unknown} value
 * @returns {number}
 */
export function clampEffectiveLightIntensity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_EFFECTIVE_LIGHT_INTENSITY;
  return Math.min(MAX_EFFECTIVE_LIGHT_INTENSITY, Math.max(0, n));
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function clampEffectiveExposure(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_EFFECTIVE_EXPOSURE;
  return Math.min(MAX_EFFECTIVE_EXPOSURE, Math.max(0, n));
}

/**
 * Normalize for export / MSF — values are *effective* (UI × 2).
 * Accepts either UI fields (`lightIntensityUi`) or effective (`lightIntensity`).
 * @param {object} [partial]
 */
export function normalizeViewportLightingState(partial = {}) {
  const hasUiLight = partial.lightIntensityUi != null;
  const hasUiExp = partial.exposureUi != null;
  const lightIntensity = hasUiLight
    ? uiToEffectiveLightIntensity(partial.lightIntensityUi)
    : clampEffectiveLightIntensity(
        partial.lightIntensity ?? DEFAULT_EFFECTIVE_LIGHT_INTENSITY,
      );
  const exposure = hasUiExp
    ? uiToEffectiveExposure(partial.exposureUi)
    : clampEffectiveExposure(partial.exposure ?? DEFAULT_EFFECTIVE_EXPOSURE);

  return {
    version: 1,
    lightIntensity,
    exposure,
    lightIntensityUi: hasUiLight
      ? clampViewportLightIntensity(partial.lightIntensityUi)
      : lightIntensity / VIEWPORT_UI_TO_EFFECTIVE_SCALE,
    exposureUi: hasUiExp
      ? clampViewportExposure(partial.exposureUi)
      : exposure / VIEWPORT_UI_TO_EFFECTIVE_SCALE,
    toneMapping: String(partial.toneMapping || DEFAULT_VIEWPORT_TONE_MAPPING),
    lightingPreset: String(partial.lightingPreset || DEFAULT_VIEWPORT_LIGHTING_PRESET),
  };
}

/**
 * Payload written into glTF scene.extras (and MSF sidecar JSON).
 * @param {object} [partial]
 */
export function buildViewportLightingExtras(partial = {}) {
  return {
    [VIEWPORT_LIGHTING_EXTRAS_KEY]: normalizeViewportLightingState(partial),
  };
}

/**
 * Read lighting extras from a loaded GLTF / scene userData.
 * @param {object|null|undefined} gltfOrScene
 * @returns {ReturnType<typeof normalizeViewportLightingState>|null}
 */
export function readViewportLightingExtras(gltfOrScene) {
  if (!gltfOrScene || typeof gltfOrScene !== 'object') return null;
  const candidates = [
    gltfOrScene.userData?.[VIEWPORT_LIGHTING_EXTRAS_KEY],
    gltfOrScene.scene?.userData?.[VIEWPORT_LIGHTING_EXTRAS_KEY],
    gltfOrScene[VIEWPORT_LIGHTING_EXTRAS_KEY],
  ];
  for (const raw of candidates) {
    if (raw && typeof raw === 'object' && raw.lightIntensity != null) {
      return normalizeViewportLightingState(raw);
    }
  }
  return null;
}

/**
 * Add punctual lights using *effective* intensity (UI × 2).
 * @param {typeof import('three')} THREE
 * @param {import('three').Scene} scene
 * @param {number} lightIntensityEffective
 */
export function addViewportLightsForExport(THREE, scene, lightIntensityEffective) {
  const I = clampEffectiveLightIntensity(lightIntensityEffective);

  const ambient = new THREE.AmbientLight(0xffffff, I * 0.3);
  ambient.name = 'opennexusExportAmbient';
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, I);
  key.name = 'opennexusExportKey';
  key.position.set(5, 8, 3);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, I * 0.35);
  fill.name = 'opennexusExportFill';
  fill.position.set(-3, 5, 2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, I * 0.25);
  rim.name = 'opennexusExportRim';
  rim.position.set(-2, 3, -5);
  scene.add(rim);

  if (THREE.HemisphereLight) {
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x362d1d, I * 0.4);
    hemi.name = 'opennexusExportHemi';
    hemi.position.set(0, 10, 0);
    scene.add(hemi);
  }
}
