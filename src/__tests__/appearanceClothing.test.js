import { describe, it, expect } from 'vitest';
import {
  inferAppearanceSlot,
  equipSlotForAppearance,
  buildAppearanceComponentAutoRigOptions,
  isAppearanceClothingName,
} from '../library/appearanceClothing.js';
import { AUTO_RIG_MODES, APPEARANCE_COMPONENT_RIG_MODEL_ID } from '../library/avatarPipelineCatalog.js';
import { inferAutoRigPipelineKind, autoRigSelectionForPipelineKind } from '../library/aiModelsCatalog.js';

describe('appearanceClothing', () => {
  it('maps joggers/pants to Legs and equips Waist', () => {
    expect(inferAppearanceSlot({ objectName: 'Joggers' })).toBe('Legs');
    expect(inferAppearanceSlot({ objectName: 'Jogging Pants' })).toBe('Legs');
    expect(equipSlotForAppearance('Legs')).toBe('Waist');
  });

  it('builds appearance_component auto-rig options', () => {
    const opts = buildAppearanceComponentAutoRigOptions({ objectName: 'Joggers' });
    expect(opts.rig_mode).toBe(AUTO_RIG_MODES.APPEARANCE_COMPONENT);
    expect(opts.appearance_slot).toBe('Legs');
    expect(opts.model_preference).toBe(APPEARANCE_COMPONENT_RIG_MODEL_ID);
  });

  it('routes clothing names away from SkinTokens', () => {
    expect(isAppearanceClothingName({ objectName: 'Blue Hoodie' })).toBe(true);
    expect(inferAutoRigPipelineKind({ objectName: 'Joggers' })).toBe('appearance');
    const sel = autoRigSelectionForPipelineKind('appearance', { objectName: 'Joggers' });
    expect(sel.rigMode).toBe(AUTO_RIG_MODES.APPEARANCE_COMPONENT);
    expect(sel.modelPreference).toBe(APPEARANCE_COMPONENT_RIG_MODEL_ID);
  });
});
