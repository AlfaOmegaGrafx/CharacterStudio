import React from 'react';
import {
  TEXT_TO_IMAGE_VIEW_OPTIONS,
  normalizeTextToImagePromptOptions,
  previewTextToImagePrompt,
} from '../library/textToImagePromptOptions.js';

const chipStyle = (active) => ({
  fontSize: '0.58rem',
  padding: '0.15rem 0.4rem',
  borderRadius: '999px',
  border: active ? '1px solid #6af' : '1px solid #555',
  background: active ? '#1a2a3a' : '#1a1a1a',
  color: active ? '#cef' : '#bbb',
  cursor: 'pointer',
});

/**
 * Krea text-to-image prompt modifiers (background, framing, camera).
 */
export default function TextToImagePromptOptions({ value, onChange, basePrompt = '' }) {
  const opts = normalizeTextToImagePromptOptions(value);

  const setOpt = (patch) => {
    onChange?.(normalizeTextToImagePromptOptions({ ...opts, ...patch }));
  };

  const toggleTPose = () => {
    const next = !opts.t_pose;
    setOpt({ t_pose: next, a_pose: false });
  };

  const toggleAPose = () => {
    const next = !opts.a_pose;
    setOpt({ a_pose: next, t_pose: false });
  };

  const preview = previewTextToImagePrompt(basePrompt, opts);

  return (
    <div className="mb-1.5" style={{ fontSize: '0.6rem' }}>
      <div style={{ color: '#aaa', marginBottom: '0.25rem' }}>Image options</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.35rem' }}>
        <button
          type="button"
          style={chipStyle(Boolean(opts.remove_background))}
          onClick={() => setOpt({ remove_background: !opts.remove_background })}
        >
          Remove background
        </button>
        <button
          type="button"
          style={chipStyle(Boolean(opts.full_body))}
          onClick={() => setOpt({ full_body: !opts.full_body })}
        >
          Full body
        </button>
        <button
          type="button"
          style={chipStyle(Boolean(opts.t_pose))}
          onClick={toggleTPose}
        >
          T-pose
        </button>
        <button
          type="button"
          style={chipStyle(Boolean(opts.a_pose))}
          onClick={toggleAPose}
        >
          A-pose
        </button>
      </div>
      <div style={{ color: '#888', marginBottom: '0.2rem' }}>Camera angle</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        {TEXT_TO_IMAGE_VIEW_OPTIONS.map((view) => (
          <button
            key={view.id || 'any'}
            type="button"
            style={chipStyle(opts.camera_view === view.id)}
            onClick={() => setOpt({ camera_view: view.id })}
          >
            {view.label}
          </button>
        ))}
      </div>
      {preview ? (
        <p style={{ fontSize: '0.55rem', color: '#7a9', margin: '0.35rem 0 0', lineHeight: 1.35 }}>
          Prompt sent: {preview}
        </p>
      ) : null}
    </div>
  );
}
