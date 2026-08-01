import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TaskProvider, useTask } from '../context/TaskContext';
import {
  createStudioProject,
  DEFAULT_STUDIO_TEMPLATE_ID,
  getPromptText,
  getStudioTemplate,
  getTextToImagePromptOptions,
  loadProjectFromStorage,
  saveProjectToStorage,
  setPromptText,
  setTextToImagePromptOptions,
  STUDIO_TEMPLATES,
  updateNode,
} from '../library/studioGraph.js';
import { previewTextToImagePrompt } from '../library/textToImagePromptOptions.js';
import { runStudioPipeline } from '../library/studioGraphExecutor.js';
import { resolveTaskModelUrl } from '../library/taskModelUrl.js';
import { get3daigcAuthHeaders } from '../library/taskManager.js';
import TextToImagePromptOptions from '../components/TextToImagePromptOptions.jsx';
import StudioGraphView from '../components/studio/StudioGraphView.jsx';
import StudioKanbanView from '../components/studio/StudioKanbanView.jsx';
import './StudioPage.css';

function StudioAuthenticatedThumb({ imageUrl, apiEndpoint, label }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let revoked = false;
    let objectUrl = null;
    if (!imageUrl) {
      setSrc(null);
      return undefined;
    }
    const absolute = resolveTaskModelUrl(imageUrl, apiEndpoint) || imageUrl;
    (async () => {
      try {
        const response = await fetch(absolute, { headers: get3daigcAuthHeaders() });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!revoked) setSrc(null);
      }
    })();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl, apiEndpoint]);

  return (
    <figure className="studio-view-thumb">
      {src ? (
        <img src={src} alt={label || 'view'} />
      ) : (
        <div className="studio-image-preview-loading">…</div>
      )}
      {label ? <figcaption>{label}</figcaption> : null}
    </figure>
  );
}

function StudioImagePreview({ imageUrl, views, apiEndpoint }) {
  const list =
    Array.isArray(views) && views.length > 0
      ? views
      : imageUrl
        ? [{ viewId: 'front', imageUrl }]
        : [];
  if (!list.length) return null;
  return (
    <div className="studio-image-preview studio-image-preview-gallery">
      <div className="studio-image-preview-label">
        {list.length > 1
          ? `Turnaround (${list.length} views) — review before mesh`
          : 'Generated image (review before mesh)'}
      </div>
      <div className="studio-view-grid">
        {list.map((view) => (
          <StudioAuthenticatedThumb
            key={view.viewId || view.imageUrl}
            imageUrl={view.imageUrl}
            apiEndpoint={apiEndpoint}
            label={view.viewId}
          />
        ))}
      </div>
    </div>
  );
}

function StudioPageInner() {
  const {
    createAndStartTask,
    getTask,
    getAllTasks,
    isConnected,
    getApiEndpoint,
  } = useTask();
  const [viewMode, setViewMode] = useState('graph');
  const [project, setProject] = useState(() => {
    return loadProjectFromStorage() || createStudioProject(DEFAULT_STUDIO_TEMPLATE_ID);
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [statusLine, setStatusLine] = useState('');
  const projectRef = useRef(project);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    saveProjectToStorage(project);
  }, [project]);

  const template = getStudioTemplate(project.templateId);
  const isMultiview = project.templateId === 'krea_trellis_multiview';
  const prompt = getPromptText(project);
  const promptOptions = getTextToImagePromptOptions(project);
  const composedPreview = useMemo(
    () => previewTextToImagePrompt(prompt, promptOptions),
    [prompt, promptOptions],
  );
  const imageNode = project.nodes.find((n) => n.kind === 'text_to_image');
  const meshNode = project.nodes.find((n) => n.kind === 'image_to_3d');
  const rigNode = project.nodes.find((n) => n.kind === 'auto_rigging');
  const exportNode = project.nodes.find((n) => n.kind === 'export_asset');
  const imageUrl = imageNode?.data?.imageUrl || null;
  const imageViews = imageNode?.data?.views || null;
  const meshUrl =
    exportNode?.data?.meshUrl || rigNode?.data?.meshUrl || meshNode?.data?.meshUrl;
  const apiEndpoint = getApiEndpoint?.() || '/__dev_dgx_proxy';
  const imageReady = Boolean(imageUrl) && imageNode?.status === 'completed';
  const meshReady = Boolean(meshNode?.data?.meshUrl) && meshNode?.status === 'completed';

  const handlePromptChange = (event) => {
    setProject((prev) => setPromptText(prev, event.target.value));
  };

  const handlePromptOptionsChange = (nextOptions) => {
    setProject((prev) => setTextToImagePromptOptions(prev, nextOptions));
  };

  const handleProjectNameChange = (event) => {
    const name = event.target.value;
    setProject((prev) => {
      let next = { ...prev, name };
      const mesh = prev.nodes.find((n) => n.kind === 'image_to_3d');
      if (mesh) {
        next = updateNode(next, mesh.id, { data: { objectName: name || 'studio_asset' } });
      }
      return next;
    });
  };

  const handleSelectTemplate = (templateId) => {
    if (running || templateId === project.templateId) return;
    setError(null);
    setStatusLine('');
    setProject(
      createStudioProject(templateId, {
        prompt: getPromptText(project),
        projectName: getStudioTemplate(templateId).defaultName,
      }),
    );
  };

  const handleReset = () => {
    setError(null);
    setStatusLine('');
    setProject(
      createStudioProject(project.templateId || DEFAULT_STUDIO_TEMPLATE_ID, {
        prompt: '',
        projectName: template.defaultName,
      }),
    );
  };

  const runPipeline = useCallback(
    async (mode) => {
      setError(null);
      setRunning(true);
      const meshLabel = isMultiview ? 'TRELLIS multiview' : 'TRELLIS.2';
      const label =
        mode === 'image'
          ? isMultiview
            ? 'Running Krea 6-view turnaround…'
            : 'Running Krea text-to-image…'
          : mode === 'mesh'
            ? `Running ${meshLabel} image-to-3D…`
            : mode === 'rig'
              ? 'Running SkinTokens auto-rigging…'
              : `Running ${template.label} pipeline (image → mesh → rig)…`;
      setStatusLine(label);
      try {
        const endpoint = getApiEndpoint?.() || '/__dev_dgx_proxy';
        const deps = {
          createAndStartTask,
          getTask,
          listTasks: getAllTasks,
          apiEndpoint: endpoint,
          onProjectChange: (next) => {
            projectRef.current = next;
            setProject(next);
          },
          onStatus: setStatusLine,
        };

        let next = projectRef.current;
        if (mode === 'mesh') {
          next = await runStudioPipeline(next, deps, {
            skipKinds: ['text_to_image'],
            until: 'image_to_3d',
          });
        } else if (mode === 'rig') {
          next = await runStudioPipeline(next, deps, {
            skipKinds: ['text_to_image', 'image_to_3d'],
          });
        } else if (mode === 'image') {
          next = await runStudioPipeline(next, deps, { until: 'text_to_image' });
          projectRef.current = next;
          setProject(next);
          setStatusLine(`Image ready — starting ${meshLabel}…`);
          next = await runStudioPipeline(next, deps, {
            skipKinds: ['text_to_image'],
            until: 'image_to_3d',
          });
        } else {
          // full: image → mesh → auto-rig
          next = await runStudioPipeline(next, deps, {});
          const meshNodeAfter = next.nodes.find((n) => n.kind === 'image_to_3d');
          const imageNodeAfter = next.nodes.find((n) => n.kind === 'text_to_image');
          if (
            imageNodeAfter?.status === 'completed' &&
            imageNodeAfter?.data?.imageUrl &&
            meshNodeAfter?.status !== 'completed'
          ) {
            setStatusLine(`Image ready — starting ${meshLabel}…`);
            next = await runStudioPipeline(next, deps, { skipKinds: ['text_to_image'] });
          }
        }

        projectRef.current = next;
        setProject(next);
        setStatusLine('Pipeline complete');
      } catch (err) {
        console.error('Studio pipeline failed', err);
        setError(err?.message || String(err));
        setStatusLine('Pipeline failed');
      } finally {
        setRunning(false);
      }
    },
    [
      createAndStartTask,
      getTask,
      getAllTasks,
      getApiEndpoint,
      isMultiview,
      template.label,
    ],
  );

  return (
    <div className="studio-page">
      <header className="studio-page-header">
        <div className="studio-page-brand">
          <Link to="/" className="studio-page-back">
            ← Viewport
          </Link>
          <h1>OpenNexus Studio</h1>
          <span className="studio-page-sub">
            Prompt · Canvas · Asset — local DGX via 3DAIGC-API
          </span>
        </div>
        <div className="studio-page-actions">
          <span
            className={`studio-api-pill ${isConnected ? 'ok' : 'down'}`}
            title="3DAIGC-API connection"
          >
            {isConnected ? 'API connected' : 'API offline'}
          </span>
          <div className="studio-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={viewMode === 'graph' ? 'active' : ''}
              onClick={() => setViewMode('graph')}
            >
              Graph
            </button>
            <button
              type="button"
              className={viewMode === 'kanban' ? 'active' : ''}
              onClick={() => setViewMode('kanban')}
            >
              Kanban
            </button>
          </div>
          <button type="button" className="studio-btn ghost" onClick={handleReset} disabled={running}>
            Reset template
          </button>
          <button
            type="button"
            className="studio-btn"
            onClick={() => void runPipeline('image')}
            disabled={running || !isConnected || !prompt.trim()}
          >
            {running ? 'Running…' : 'Generate image'}
          </button>
          <button
            type="button"
            className="studio-btn"
            onClick={() => void runPipeline('mesh')}
            disabled={running || !isConnected || !imageReady}
            title={
              imageReady
                ? isMultiview
                  ? 'Send turnaround to TRELLIS multiview'
                  : 'Send reviewed image to TRELLIS.2'
                : 'Generate an image first'
            }
          >
            Generate mesh
          </button>
          <button
            type="button"
            className="studio-btn"
            onClick={() => void runPipeline('rig')}
            disabled={running || !isConnected || !meshReady}
            title={
              meshReady
                ? 'Auto-rig the completed mesh (SkinTokens)'
                : 'Generate a mesh first'
            }
          >
            Auto-rig mesh
          </button>
          <button
            type="button"
            className="studio-btn primary"
            onClick={() => void runPipeline('full')}
            disabled={running || !isConnected || !prompt.trim()}
          >
            {running ? 'Running…' : 'Run full pipeline'}
          </button>
        </div>
      </header>

      <section className="studio-page-controls">
        <label className="studio-field">
          <span>Project name</span>
          <input
            type="text"
            value={project.name}
            onChange={handleProjectNameChange}
            disabled={running}
          />
        </label>
        <label className="studio-field studio-field-wide">
          <span>Subject prompt</span>
          <textarea
            rows={2}
            value={prompt}
            onChange={handlePromptChange}
            placeholder="dragon knight character, humanoid…"
            disabled={running}
          />
        </label>
        <div className="studio-template-picker" role="group" aria-label="Pipeline template">
          {STUDIO_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`studio-template-chip ${project.templateId === t.id ? 'active' : ''}`}
              title={t.description}
              disabled={running}
              onClick={() => handleSelectTemplate(t.id)}
            >
              {t.shortLabel}
            </button>
          ))}
        </div>
      </section>

      <section className="studio-page-krea-options">
        <TextToImagePromptOptions
          value={promptOptions}
          onChange={handlePromptOptionsChange}
          basePrompt={prompt}
        />
        <p className="studio-mesh-hint">
          {isMultiview ? (
            <>
              <strong>Multiview pipeline:</strong> generates front / back / left / right / top /
              bottom with one shared seed, then TRELLIS multiview mesh. Keep Full body, T-pose, and
              Remove background. Expect ~6× single-image Krea time.
            </>
          ) : (
            <>
              <strong>TRELLIS.2 pipeline:</strong> one mesh-ready image (Full body, T-pose, Remove
              background, Front view recommended). Switch to <strong>Multiview</strong> for a
              six-angle turnaround.
            </>
          )}
        </p>
        {composedPreview ? (
          <p className="studio-composed-prompt">Will send: {composedPreview}</p>
        ) : null}
      </section>

      {(error || statusLine) && (
        <div className={`studio-status-banner ${error ? 'error' : ''}`}>
          {error || statusLine}
        </div>
      )}

      <StudioImagePreview
        imageUrl={imageUrl}
        views={imageViews}
        apiEndpoint={apiEndpoint}
      />

      <main className="studio-page-main">
        {viewMode === 'graph' ? (
          <StudioGraphView project={project} />
        ) : (
          <StudioKanbanView project={project} />
        )}
      </main>

      <footer className="studio-page-footer">
        {meshUrl ? (
          <a className="studio-btn primary" href={`/?loadMesh=${encodeURIComponent(meshUrl)}`}>
            Open mesh in viewport
          </a>
        ) : (
          <span className="studio-footer-hint">
            Generate a mesh-ready image, review it, then Generate mesh (or Run full pipeline).
          </span>
        )}
      </footer>
    </div>
  );
}

export default function StudioPage() {
  return (
    <TaskProvider>
      <StudioPageInner />
    </TaskProvider>
  );
}
