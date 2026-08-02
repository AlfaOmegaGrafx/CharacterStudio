/**
 * Creature rig pipeline — Mesh2Motion fox / quadruped template on 3DAIGC-API.
 * Backend: `rig_mode: "creature_template"` + `creature_template_id` (Blender, no GPU).
 */

export const DEFAULT_CREATURE_TEMPLATE_ID = 'fox';

export const CREATURE_TEMPLATE_RIG_MODEL_ID = 'creature_template_auto_rig';

export const CREATURE_TEMPLATE_OPTIONS = [
  {
    value: 'fox',
    label: 'Quadruped (Mesh2Motion fox rig)',
    mesh2motionType: 'fox',
  },
];

/**
 * @param {string} [templateId]
 * @returns {string}
 */
export function normalizeCreatureTemplateId(templateId) {
  const id = String(templateId || DEFAULT_CREATURE_TEMPLATE_ID).trim().toLowerCase();
  if (id === 'quadruped') return 'fox';
  return id || DEFAULT_CREATURE_TEMPLATE_ID;
}

/**
 * @param {object} [options]
 * @returns {{ rig_mode: string, creature_template_id: string, output_format: string, model_preference: string }}
 */
export function buildCreatureAutoRigOptions(options = {}) {
  return {
    rig_mode: 'creature_template',
    creature_template_id: normalizeCreatureTemplateId(options.creature_template_id),
    output_format: 'glb',
    model_preference: CREATURE_TEMPLATE_RIG_MODEL_ID,
  };
}

/**
 * @param {object} [rigInfo]
 * @returns {boolean}
 */
export function isCreatureTemplateRigInfo(rigInfo) {
  if (!rigInfo || typeof rigInfo !== 'object') return false;
  return (
    rigInfo.rig_mode === 'creature_template' ||
    rigInfo.rig_type === 'creature_template' ||
    rigInfo.generation_method === 'mesh2motion_creature_template'
  );
}
