/**
 * Appearance Editor clothing / component fitting helpers.
 *
 * Maps wearable object names → Choose Appearance trait slots and builds
 * auto-rig options for `rig_mode: appearance_component`.
 */

import {
  AUTO_RIG_MODES,
  APPEARANCE_COMPONENT_RIG_MODEL_ID,
} from './avatarPipelineCatalog.js';

/** Canonical Loot / Appearance trait ids. */
export const APPEARANCE_SLOTS = [
  'Body',
  'Head',
  'Hands',
  'Shoes',
  'Chest',
  'Waist',
  'Neck',
  'Legs',
];

/** When Legs is missing from the pack, equip into Waist (waistband). */
export const APPEARANCE_SLOT_EQUIP_FALLBACK = {
  Legs: 'Waist',
};

const NAME_TO_SLOT = [
  [/\b(jogger|joggers|pants|trousers|shorts|jeans|leggings|skirt|kilt)\b/i, 'Legs'],
  [/\b(shoe|shoes|boot|boots|sneaker|sneakers|sandal|footwear|greave)\b/i, 'Shoes'],
  [/\b(glove|gloves|gauntlet|mitten)\b/i, 'Hands'],
  [/\b(hat|cap|helmet|hood|crown|headwear|mask)\b/i, 'Head'],
  [/\b(necklace|collar|choker|scarf|pendant)\b/i, 'Neck'],
  [/\b(belt|sash|cummerbund|waistband)\b/i, 'Waist'],
  [/\b(shirt|jacket|coat|hoodie|sweater|armor|robe|chest|torso|vest|blouse|top)\b/i, 'Chest'],
  [/\b(clothing|outfit|wearable|apparel|garment)\b/i, 'Chest'],
];

const SLOT_ALIASES = {
  pants: 'Legs',
  legs: 'Legs',
  lower: 'Legs',
  lowerbody: 'Legs',
  lower_body: 'Legs',
  torso: 'Chest',
  upper: 'Chest',
  upperbody: 'Chest',
  hair: 'Head',
  footwear: 'Shoes',
  gloves: 'Hands',
  belt: 'Waist',
};

/**
 * @param {string} [slot]
 * @returns {string|null}
 */
export function normalizeAppearanceSlot(slot) {
  if (!slot) return null;
  const raw = String(slot).trim();
  if (!raw) return null;
  const hit = APPEARANCE_SLOTS.find((s) => s.toLowerCase() === raw.toLowerCase());
  if (hit) return hit;
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
  return SLOT_ALIASES[key] || SLOT_ALIASES[raw.toLowerCase()] || null;
}

/**
 * @param {{ objectName?: string, meshFileName?: string, appearanceSlot?: string }} [hints]
 * @returns {string|null}
 */
export function inferAppearanceSlot(hints = {}) {
  const explicit = normalizeAppearanceSlot(hints.appearanceSlot);
  if (explicit) return explicit;
  const text = `${hints.objectName || ''} ${hints.meshFileName || ''}`.trim();
  if (!text) return null;
  for (const [re, slot] of NAME_TO_SLOT) {
    if (re.test(text)) return slot;
  }
  return null;
}

/**
 * @param {string} slot
 * @returns {string}
 */
export function equipSlotForAppearance(slot) {
  const normalized = normalizeAppearanceSlot(slot) || slot;
  return APPEARANCE_SLOT_EQUIP_FALLBACK[normalized] || normalized;
}

/**
 * @param {{ objectName?: string, meshFileName?: string, appearanceSlot?: string }} [hints]
 * @returns {boolean}
 */
export function isAppearanceClothingName(hints = {}) {
  return inferAppearanceSlot(hints) != null;
}

/**
 * Build auto-rig request fields for Appearance clothing fit.
 * @param {{ appearance_slot?: string, objectName?: string }} [options]
 */
export function buildAppearanceComponentAutoRigOptions(options = {}) {
  const slot =
    normalizeAppearanceSlot(options.appearance_slot) ||
    inferAppearanceSlot({ objectName: options.objectName }) ||
    'Legs';
  return {
    rig_mode: AUTO_RIG_MODES.APPEARANCE_COMPONENT,
    appearance_slot: slot,
    output_format: 'glb',
    model_preference: APPEARANCE_COMPONENT_RIG_MODEL_ID,
  };
}

/**
 * Equip a completed appearance-component VRM into CharacterManager.
 * @param {object} characterManager
 * @param {string} url - Absolute VRM (or GLB) URL
 * @param {string} appearanceSlot
 * @returns {Promise<{ slot: string, equipped: boolean, error?: string }>}
 */
export async function equipAppearanceComponentTrait(characterManager, url, appearanceSlot) {
  if (!characterManager?.loadCustomTrait) {
    return { slot: appearanceSlot, equipped: false, error: 'No characterManager' };
  }
  const preferred = normalizeAppearanceSlot(appearanceSlot) || appearanceSlot || 'Waist';
  const candidates = [preferred, equipSlotForAppearance(preferred), 'Waist', 'Chest'].filter(
    (v, i, a) => v && a.indexOf(v) === i,
  );
  let lastError = null;
  for (const slot of candidates) {
    try {
      await characterManager.loadCustomTrait(slot, url);
      console.log(`[Appearance] Equipped custom clothing into ${slot}:`, url);
      return { slot, equipped: true };
    } catch (err) {
      lastError = err?.message || String(err);
      console.warn(`[Appearance] loadCustomTrait(${slot}) failed:`, lastError);
    }
  }
  return { slot: preferred, equipped: false, error: lastError || 'equip failed' };
}
