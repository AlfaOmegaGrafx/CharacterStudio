/**
 * Text-to-image (Krea 2) prompt modifiers — appended to the user's subject prompt.
 */

export const TEXT_TO_IMAGE_VIEW_OPTIONS = [
  { id: '', label: 'Any view' },
  { id: 'front', label: 'Front view' },
  { id: 'back', label: 'Back view' },
  { id: 'side_left', label: 'Side view (left)' },
  { id: 'side_right', label: 'Side view (right)' },
  { id: 'top', label: 'Top view' },
  { id: 'bottom', label: 'Bottom view' },
];

/** Orthographic turnaround used for Studio → TRELLIS multiview (primary = front). */
export const STUDIO_ORTHOGRAPHIC_VIEW_IDS = Object.freeze([
  'front',
  'back',
  'side_left',
  'side_right',
  'top',
  'bottom',
]);

export const DEFAULT_TEXT_TO_IMAGE_PROMPT_OPTIONS = {
  remove_background: false,
  full_body: false,
  t_pose: false,
  a_pose: false,
  camera_view: '',
  all_orthographic_views: false,
};

/**
 * Defaults for single-image Studio → TRELLIS.2 (mesh-ready framing, one camera).
 */
export const STUDIO_MESH_READY_TEXT_TO_IMAGE_OPTIONS = {
  remove_background: true,
  full_body: true,
  t_pose: true,
  a_pose: false,
  camera_view: 'front',
  all_orthographic_views: false,
};

/**
 * Defaults for orthographic turnaround → TRELLIS multiview (6 views, shared seed).
 */
export const STUDIO_MULTIVIEW_TEXT_TO_IMAGE_OPTIONS = {
  remove_background: true,
  full_body: true,
  t_pose: true,
  a_pose: false,
  camera_view: 'front',
  all_orthographic_views: true,
};

const VIEW_PROMPT_FRAGMENTS = {
  front: 'front view, facing camera, orthographic',
  back: 'back view, rear orthographic angle',
  side_left: 'left side profile view, orthographic',
  side_right: 'right side profile view, orthographic',
  top: 'top-down orthographic view, bird eye angle',
  bottom: 'bottom-up orthographic view, worm eye angle',
};

const T_POSE_FRAGMENT =
  'T-pose, arms extended horizontally to the sides, legs straight';
const A_POSE_FRAGMENT =
  'A-pose, arms slightly angled down from horizontal, legs straight';

const MULTIVIEW_CONSISTENCY_FRAGMENT =
  'character turnaround sheet, identical character identity outfit colors and proportions across all views, even studio lighting, no dramatic cinematic shadows';

/**
 * Ensures at most one pose preset is active (T-pose wins if both were set).
 * @param {object|null|undefined} options
 * @returns {object}
 */
export function normalizeTextToImagePromptOptions(options) {
  const opts = { ...DEFAULT_TEXT_TO_IMAGE_PROMPT_OPTIONS, ...(options || {}) };
  if (opts.t_pose && opts.a_pose) {
    opts.a_pose = false;
  }
  opts.all_orthographic_views = Boolean(opts.all_orthographic_views);
  if (opts.all_orthographic_views && !opts.camera_view) {
    opts.camera_view = 'front';
  }
  return opts;
}

/**
 * @param {string} basePrompt
 * @param {object|null|undefined} options
 * @param {{ forMultiviewSet?: boolean }} [extra]
 * @returns {string}
 */
export function buildTextToImagePrompt(basePrompt, options, extra = {}) {
  const subject = String(basePrompt || '').trim();
  if (!subject) return '';

  const opts = normalizeTextToImagePromptOptions(options);
  const parts = [subject];

  if (opts.full_body) {
    parts.push('full body shot, head to toe visible');
  }
  if (opts.t_pose) {
    parts.push(T_POSE_FRAGMENT);
  } else if (opts.a_pose) {
    parts.push(A_POSE_FRAGMENT);
  }
  if (opts.remove_background) {
    parts.push('plain white background, isolated subject, no scenery');
  }
  if (extra.forMultiviewSet || opts.all_orthographic_views) {
    parts.push(MULTIVIEW_CONSISTENCY_FRAGMENT);
  }
  const viewFrag = VIEW_PROMPT_FRAGMENTS[opts.camera_view];
  if (viewFrag) {
    parts.push(viewFrag);
  }

  return parts.join(', ');
}

/**
 * Build one composed prompt per orthographic view (same subject + modifiers, different camera).
 * @param {string} basePrompt
 * @param {object|null|undefined} options
 * @returns {{ viewId: string, label: string, prompt: string }[]}
 */
export function buildOrthographicMultiviewPrompts(basePrompt, options) {
  const baseOpts = normalizeTextToImagePromptOptions(options);
  return STUDIO_ORTHOGRAPHIC_VIEW_IDS.map((viewId) => {
    const label =
      TEXT_TO_IMAGE_VIEW_OPTIONS.find((v) => v.id === viewId)?.label || viewId;
    return {
      viewId,
      label,
      prompt: buildTextToImagePrompt(
        basePrompt,
        { ...baseOpts, camera_view: viewId, all_orthographic_views: true },
        { forMultiviewSet: true },
      ),
    };
  });
}

/**
 * @param {string} basePrompt
 * @param {object|null|undefined} options
 * @returns {string|null}
 */
export function previewTextToImagePrompt(basePrompt, options) {
  const opts = normalizeTextToImagePromptOptions(options);
  if (opts.all_orthographic_views) {
    const views = buildOrthographicMultiviewPrompts(basePrompt, opts);
    if (!views.length || !views[0].prompt) return null;
    return `6 views (same seed): ${views.map((v) => v.viewId).join(', ')} — e.g. ${views[0].prompt}`;
  }
  const built = buildTextToImagePrompt(basePrompt, opts);
  const subject = String(basePrompt || '').trim();
  if (!subject || built === subject) return null;
  return built;
}

/**
 * Shared RNG seed for a multiview batch (identity lock across camera angles).
 * @returns {number}
 */
export function createMultiviewSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}
