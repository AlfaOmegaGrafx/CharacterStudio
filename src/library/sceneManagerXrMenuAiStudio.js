/**
 * XR menu extras — AI Tasks, Animation AI (Kimodo), Character Studio actions.
 * Uses SceneManager bridges from XrMenuBridge / SceneContext (no React in headset loop).
 */
import { playTextToMotionOnViewport } from './playViewportMotion.js';

export const XR_MENU_TAB_AI = 'ai';
export const XR_MENU_TAB_ANIM_AI = 'anim-ai';
export const XR_MENU_TAB_STUDIO = 'studio';

/** Preset text→3D prompts (no headset keyboard). */
export const XR_T3D_PRESETS = [
  {
    id: 'hero',
    action: 'ai-t3d-hero',
    label: 'T3D · Hero figure',
    prompt: 'a stylized heroic character figure, game-ready, clean topology',
  },
  {
    id: 'prop',
    action: 'ai-t3d-prop',
    label: 'T3D · Sci-fi prop',
    prompt: 'a detailed sci-fi handheld prop, game asset, PBR ready',
  },
];

/** Preset Kimodo text→motion prompts. */
export const XR_MOTION_PRESETS = [
  {
    id: 'wave',
    action: 'anim-ai-wave',
    label: 'Motion · Wave hello',
    prompt: 'person waving hello cheerfully',
  },
  {
    id: 'walk',
    action: 'anim-ai-walk',
    label: 'Motion · Walk',
    prompt: 'person walking forward casually',
  },
  {
    id: 'dance',
    action: 'anim-ai-dance',
    label: 'Motion · Dance',
    prompt: 'person dancing happily',
  },
];

const FALLBACK_EMOTIONS = ['happy', 'angry', 'sad', 'surprised', 'relaxed', 'neutral'];

/**
 * @param {import('./sceneManager.js').SceneManager|null|undefined} sceneManager
 */
export function resolveXrTaskApi(sceneManager) {
  if (!sceneManager || typeof sceneManager.getXrTaskApi !== 'function') return null;
  return sceneManager.getXrTaskApi() || null;
}

/**
 * @param {import('./sceneManager.js').SceneManager|null|undefined} sceneManager
 */
export function resolveXrCharacterManager(sceneManager) {
  if (!sceneManager) return null;
  if (typeof sceneManager.getCharacterManager === 'function') {
    return sceneManager.getCharacterManager() || null;
  }
  return sceneManager.characterManager || null;
}

/**
 * @param {object|null} api
 */
export function xrTaskStatusLabel(api) {
  if (!api?.getTaskStats) return 'Tasks: (bridge not ready)';
  try {
    const stats = api.getTaskStats() || {};
    const running = stats.running ?? stats.Running ?? 0;
    const completed = stats.completed ?? stats.Completed ?? 0;
    const failed = stats.failed ?? stats.Failed ?? 0;
    return `Tasks · run ${running} · done ${completed} · fail ${failed}`;
  } catch {
    return 'Tasks: (stats unavailable)';
  }
}

/**
 * Newest completed mesh/world/motion task (skips text-to-image).
 * @param {object|null} api
 */
export function findLatestLoadableTask(api) {
  const tasks = api?.getAllTasks?.() || [];
  const completed = tasks
    .filter((t) => t?.status === 'completed' && t?.result)
    .filter((t) => t.type !== 'text-to-image')
    .sort((a, b) => {
      const ta = a.completedAt || a.updatedAt || a.createdAt || 0;
      const tb = b.completedAt || b.updatedAt || b.createdAt || 0;
      return tb - ta;
    });
  return completed[0] || null;
}

/**
 * Dispatch the same viewport load path as TaskManager rows.
 * @param {object} task
 */
export function dispatchXrLoadTask(task) {
  if (!task?.result || typeof window === 'undefined') return false;
  window.dispatchEvent(
    new CustomEvent('loadModelFromUrl', {
      detail: { result: task.result, taskId: task.id, task },
    }),
  );
  return true;
}

/**
 * @param {object|null} api
 * @param {string} prompt
 * @param {string} [name]
 */
export async function xrSubmitTextTo3d(api, prompt, name = 'XR Text-to-3D') {
  if (!api?.createAndStartTask) {
    throw new Error('Task API not ready');
  }
  return api.createAndStartTask({
    name,
    type: 'text-to-3d',
    prompt,
    description: `XR menu: ${prompt.slice(0, 80)}`,
  });
}

/**
 * @param {object|null} api
 * @param {import('./sceneManager.js').SceneManager} sceneManager
 * @param {string} prompt
 * @param {string} [name]
 */
export async function xrSubmitTextToMotion(api, _sceneManager, prompt, name = 'XR Kimodo') {
  if (!api?.createAndStartTask) {
    throw new Error('Task API not ready');
  }
  // Playback is handled by App's taskCompleted listener (same as 2D Tools).
  return api.createAndStartTask({
    name,
    type: 'text-to-motion',
    prompt,
    text_prompt: prompt,
    description: `XR menu motion: ${prompt.slice(0, 80)}`,
  });
}

/**
 * @param {object|null} api
 */
export function findLatestMotionTask(api) {
  const byType = api?.getTasksByType?.('text-to-motion');
  const tasks = Array.isArray(byType) ? byType : api?.getAllTasks?.() || [];
  return (
    tasks
      .filter((t) => t?.type === 'text-to-motion' && t.status === 'completed' && t.result)
      .sort((a, b) => {
        const ta = a.completedAt || a.updatedAt || a.createdAt || 0;
        const tb = b.completedAt || b.updatedAt || b.createdAt || 0;
        return tb - ta;
      })[0] || null
  );
}

/**
 * @param {object|null} api
 * @param {import('./sceneManager.js').SceneManager} sceneManager
 */
export async function xrReplayLastMotion(api, sceneManager) {
  const task = findLatestMotionTask(api);
  if (!task) throw new Error('No completed motion task');
  const cm = resolveXrCharacterManager(sceneManager);
  await playTextToMotionOnViewport({
    sceneManager,
    characterManager: cm,
    taskResult: task.result,
    apiEndpoint: api.getApiEndpoint?.(),
    displayName: task.name || 'Kimodo',
  });
  return task;
}

/**
 * @param {object|null} characterManager
 */
export async function xrRandomizeTraits(characterManager) {
  if (!characterManager?.loadRandomTraits) {
    throw new Error('Character manager not ready');
  }
  await characterManager.loadRandomTraits();
}

/**
 * @param {object|null} characterManager
 * @param {{ emotionIndex?: number }} state
 */
export function xrCycleEmotion(characterManager, state) {
  const em = characterManager?.emotionManager;
  if (!em?.playEmotion) {
    throw new Error('Emotion manager not ready');
  }
  const available =
    (Array.isArray(em.availableEmotions) && em.availableEmotions.length
      ? em.availableEmotions
      : FALLBACK_EMOTIONS) || FALLBACK_EMOTIONS;
  const idx = ((state.emotionIndex ?? 0) % available.length + available.length) % available.length;
  const emotion = available[idx];
  em.playEmotion(emotion, undefined, false, 1);
  state.emotionIndex = idx + 1;
  return emotion;
}

/**
 * @param {object|null} characterManager
 */
export function xrExportVrm(characterManager) {
  if (typeof characterManager?.downloadVRM === 'function') {
    characterManager.downloadVRM('opennexus-xr-export');
    return true;
  }
  throw new Error('VRM export not available');
}
