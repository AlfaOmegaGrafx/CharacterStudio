import { describe, expect, it } from 'vitest';
import {
  buildTextToImagePrompt,
  normalizeTextToImagePromptOptions,
  previewTextToImagePrompt,
} from '../library/textToImagePromptOptions.js';

describe('textToImagePromptOptions', () => {
  it('appends modifier fragments to the subject prompt', () => {
    const prompt = buildTextToImagePrompt('a fox', {
      remove_background: true,
      full_body: true,
      camera_view: 'side_left',
    });
    expect(prompt).toContain('a fox');
    expect(prompt).toContain('plain white background');
    expect(prompt).toContain('full body');
    expect(prompt).toContain('left side profile');
  });

  it('allows only one pose preset at a time in the built prompt', () => {
    const tPose = buildTextToImagePrompt('knight', { t_pose: true, a_pose: true });
    expect(tPose).toContain('T-pose');
    expect(tPose).not.toContain('A-pose');

    const aOnly = buildTextToImagePrompt('knight', { a_pose: true });
    expect(aOnly).toContain('A-pose');
    expect(aOnly).not.toContain('T-pose');
  });

  it('normalizes conflicting pose flags', () => {
    const normalized = normalizeTextToImagePromptOptions({ t_pose: true, a_pose: true });
    expect(normalized.t_pose).toBe(true);
    expect(normalized.a_pose).toBe(false);
  });

  it('returns null preview when no modifiers selected', () => {
    expect(previewTextToImagePrompt('a fox', {})).toBeNull();
  });
});
