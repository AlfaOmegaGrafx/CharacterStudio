import { describe, expect, it, vi } from 'vitest';
import {
  findLatestLoadableTask,
  findLatestMotionTask,
  xrTaskStatusLabel,
  xrSubmitTextTo3d,
  xrSubmitTextToMotion,
  xrCycleEmotion,
  xrExportVrm,
  dispatchXrLoadTask,
} from '../library/sceneManagerXrMenuAiStudio.js';

describe('sceneManagerXrMenuAiStudio', () => {
  it('labels task stats and finds latest loadable mesh task', () => {
    expect(xrTaskStatusLabel(null)).toMatch(/bridge not ready/);
    expect(
      xrTaskStatusLabel({
        getTaskStats: () => ({ running: 1, completed: 2, failed: 0 }),
      }),
    ).toBe('Tasks · run 1 · done 2 · fail 0');

    const latest = findLatestLoadableTask({
      getAllTasks: () => [
        {
          id: 'img',
          type: 'text-to-image',
          status: 'completed',
          result: { url: 'x' },
          completedAt: 9,
        },
        {
          id: 'old',
          type: 'text-to-3d',
          status: 'completed',
          result: { mesh_url: 'a' },
          completedAt: 1,
        },
        {
          id: 'new',
          type: 'image-to-3d',
          status: 'completed',
          result: { mesh_url: 'b' },
          completedAt: 5,
        },
      ],
    });
    expect(latest.id).toBe('new');
  });

  it('submits text-to-3d and text-to-motion presets', async () => {
    const createAndStartTask = vi.fn(async (d) => d);
    const api = { createAndStartTask };
    await xrSubmitTextTo3d(api, 'a hero', 'Hero');
    expect(createAndStartTask).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'text-to-3d', prompt: 'a hero' }),
    );
    await xrSubmitTextToMotion(api, {}, 'wave hello', 'Wave');
    expect(createAndStartTask).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'text-to-motion', prompt: 'wave hello' }),
    );
  });

  it('cycles emotions and exports VRM', () => {
    const playEmotion = vi.fn();
    const state = { emotionIndex: 0 };
    const cm = {
      emotionManager: { playEmotion, availableEmotions: ['happy', 'angry'] },
      downloadVRM: vi.fn(),
    };
    expect(xrCycleEmotion(cm, state)).toBe('happy');
    expect(xrCycleEmotion(cm, state)).toBe('angry');
    expect(xrExportVrm(cm)).toBe(true);
    expect(cm.downloadVRM).toHaveBeenCalled();
  });

  it('dispatches loadModelFromUrl for completed tasks', () => {
    const spy = vi.fn();
    window.addEventListener('loadModelFromUrl', spy);
    dispatchXrLoadTask({
      id: 't',
      result: { mesh_url: 'https://example.com/m.glb' },
    });
    expect(spy).toHaveBeenCalled();
    window.removeEventListener('loadModelFromUrl', spy);

    expect(
      findLatestMotionTask({
        getTasksByType: () => [
          {
            type: 'text-to-motion',
            status: 'completed',
            result: { motion_url: 'm' },
            completedAt: 1,
          },
        ],
      })?.result?.motion_url,
    ).toBe('m');
  });
});
