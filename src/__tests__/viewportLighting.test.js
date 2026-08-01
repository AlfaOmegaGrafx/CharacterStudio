import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VIEWPORT_LIGHT_INTENSITY,
  MAX_VIEWPORT_LIGHT_INTENSITY,
  DEFAULT_EFFECTIVE_LIGHT_INTENSITY,
  MAX_EFFECTIVE_LIGHT_INTENSITY,
  DEFAULT_EFFECTIVE_EXPOSURE,
  buildViewportLightingExtras,
  clampViewportLightIntensity,
  normalizeViewportLightingState,
  readViewportLightingExtras,
  uiToEffectiveExposure,
  uiToEffectiveLightIntensity,
} from '../library/viewportLighting.js';

describe('viewportLighting', () => {
  it('UI 1.0 maps to effective 2.0 and UI 2.0 maps to effective 4.0', () => {
    expect(DEFAULT_VIEWPORT_LIGHT_INTENSITY).toBe(1);
    expect(MAX_VIEWPORT_LIGHT_INTENSITY).toBe(2);
    expect(uiToEffectiveLightIntensity(1)).toBe(2);
    expect(uiToEffectiveLightIntensity(2)).toBe(4);
    expect(uiToEffectiveExposure(1)).toBe(2);
    expect(uiToEffectiveExposure(2)).toBe(4);
    expect(DEFAULT_EFFECTIVE_LIGHT_INTENSITY).toBe(2);
    expect(MAX_EFFECTIVE_LIGHT_INTENSITY).toBe(4);
    expect(DEFAULT_EFFECTIVE_EXPOSURE).toBe(2);
    expect(clampViewportLightIntensity(9)).toBe(2);
  });

  it('export extras store effective intensities from UI', () => {
    const extras = buildViewportLightingExtras({
      lightIntensityUi: 1,
      exposureUi: 1,
    });
    expect(extras.opennexusViewportLighting.lightIntensity).toBe(2);
    expect(extras.opennexusViewportLighting.exposure).toBe(2);
    expect(extras.opennexusViewportLighting.lightIntensityUi).toBe(1);
    const roundTrip = readViewportLightingExtras({ userData: extras });
    expect(roundTrip.lightIntensity).toBe(2);
    expect(normalizeViewportLightingState({ lightIntensity: 4, exposure: 4 }).lightIntensityUi).toBe(2);
  });
});
