import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  PREFERRED_PIPELINES,
  getDefaultModelForFeature,
} from '../library/aiModelsCatalog.js';
import {
  resolveTextToImageDownloadUrl,
  getTaskResultImageUrl,
} from '../library/taskModelUrl.js';
import { normalizeTextToImagePromptOptions } from '../library/textToImagePromptOptions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('krea2TextTo3dPipeline contract (locked)', () => {
  it('preferred pipeline is Krea text-to-image then TRELLIS.2 mesh', () => {
    expect(PREFERRED_PIPELINES.textToImageTo3d.imageModel).toBe('krea2_turbo_text_to_image');
    expect(PREFERRED_PIPELINES.textToImageTo3d.meshModel).toBe('trellis2_image_to_textured_mesh');
    expect(PREFERRED_PIPELINES.textToImageTo3d.taskTypes).toEqual([
      'text-to-image',
      'image-to-3d',
    ]);
  });

  it('defaults align with pipeline models', () => {
    expect(getDefaultModelForFeature('text-to-image')).toBe('krea2_turbo_text_to_image');
    expect(getDefaultModelForFeature('image-to-3d')).toBe('trellis2_image_to_textured_mesh');
  });

  it('resolveTextToImageDownloadUrl never returns filesystem output_image_path', () => {
    const url = resolveTextToImageDownloadUrl({
      id: 'job_contract-1',
      type: 'text-to-image',
      status: 'completed',
      result: {
        job_id: 'contract-1',
        feature: 'text_to_image',
        output_image_path: 'outputs/images/krea2_turbo_text_to_image_image_123.png',
      },
    });
    expect(url).toBe('/api/v1/system/jobs/contract-1/download');
    expect(url).not.toContain('outputs/images');
  });

  it('getTaskResultImageUrl rejects non-fetchable filesystem paths', () => {
    expect(
      getTaskResultImageUrl({
        job_id: 'contract-2',
        feature: 'text_to_image',
        output_image_path: 'outputs/images/foo.png',
      }),
    ).toBe('/api/v1/system/jobs/contract-2/download');
  });

  it('T-pose and A-pose remain mutually exclusive', () => {
    const normalized = normalizeTextToImagePromptOptions({ t_pose: true, a_pose: true });
    expect(normalized.t_pose).toBe(true);
    expect(normalized.a_pose).toBe(false);
  });

  it('TaskManager retains chain handler and label', () => {
    const taskManager = readFileSync(join(root, 'components/TaskManager.jsx'), 'utf8');
    expect(taskManager).toContain('handleUseImageForImageTo3d');
    expect(taskManager).toContain('Use for Image to 3D');
    expect(taskManager).toContain('setIsExpanded(true)');
    expect(taskManager).toContain('resolveTextToImageDownloadUrl');
  });
});
