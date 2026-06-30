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

export const DEFAULT_TEXT_TO_IMAGE_PROMPT_OPTIONS = {
  remove_background: false,
  full_body: false,
  t_pose: false,
  a_pose: false,
  camera_view: '',
};

const VIEW_PROMPT_FRAGMENTS = {
  front: 'front view, facing camera',
  back: 'back view, rear angle',
  side_left: 'left side profile view',
  side_right: 'right side profile view',
  top: 'top-down view, bird eye angle',
  bottom: 'bottom-up view, worm eye angle',
};

const T_POSE_FRAGMENT =
  'T-pose, arms extended horizontally to the sides, legs straight';
const A_POSE_FRAGMENT =
  'A-pose, arms slightly angled down from horizontal, legs straight';

/**
 * Ensures at most one pose preset is active (T-pose wins if both were set).
 * @param {object|null|undefined} options
 * @returns {typeof DEFAULT_TEXT_TO_IMAGE_PROMPT_OPTIONS}
 */
export function normalizeTextToImagePromptOptions(options) {
  const opts = { ...DEFAULT_TEXT_TO_IMAGE_PROMPT_OPTIONS, ...(options || {}) };
  if (opts.t_pose && opts.a_pose) {
    opts.a_pose = false;
  }
  return opts;
}

/**
 * @param {string} basePrompt
 * @param {object|null|undefined} options
 * @returns {string}
 */
export function buildTextToImagePrompt(basePrompt, options) {
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
  const viewFrag = VIEW_PROMPT_FRAGMENTS[opts.camera_view];
  if (viewFrag) {
    parts.push(viewFrag);
  }

  return parts.join(', ');
}

/**
 * @param {object|null|undefined} options
 * @returns {string|null}
 */
export function previewTextToImagePrompt(basePrompt, options) {
  const built = buildTextToImagePrompt(basePrompt, options);
  const subject = String(basePrompt || '').trim();
  if (!subject || built === subject) return null;
  return built;
}
