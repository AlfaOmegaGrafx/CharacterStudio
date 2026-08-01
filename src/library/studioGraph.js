/**
 * Studio pipeline graph — Lychee/3DGenStudio-style node model.
 * Execution stays in TaskManager / 3DAIGC-API; this module is pure data.
 */

import {
  normalizeTextToImagePromptOptions,
  STUDIO_MESH_READY_TEXT_TO_IMAGE_OPTIONS,
  STUDIO_MULTIVIEW_TEXT_TO_IMAGE_OPTIONS,
} from './textToImagePromptOptions.js';

export const STUDIO_STAGES = Object.freeze([
  { id: 'prompt', label: 'Prompt' },
  { id: 'image', label: 'Image' },
  { id: 'mesh', label: 'Mesh' },
  { id: 'rig', label: 'Rig' },
  { id: 'export', label: 'Export' },
]);

export const STUDIO_NODE_KINDS = Object.freeze({
  text_prompt: {
    id: 'text_prompt',
    label: 'Text Prompt',
    stage: 'prompt',
    runnable: false,
  },
  text_to_image: {
    id: 'text_to_image',
    label: 'Text to Image',
    stage: 'image',
    runnable: true,
    taskType: 'text-to-image',
    defaultModel: 'krea2_turbo_text_to_image',
  },
  image_to_3d: {
    id: 'image_to_3d',
    label: 'Image to 3D',
    stage: 'mesh',
    runnable: true,
    taskType: 'image-to-3d',
    defaultModel: 'trellis2_image_to_textured_mesh',
  },
  auto_rigging: {
    id: 'auto_rigging',
    label: 'Auto Rigging',
    stage: 'rig',
    runnable: true,
    taskType: 'auto-rigging',
    defaultModel: 'skintokens_auto_rig',
  },
  export_asset: {
    id: 'export_asset',
    label: 'Open in Viewport',
    stage: 'export',
    runnable: false,
  },
});

/** Selectable Studio pipeline templates (separate product paths). */
export const STUDIO_TEMPLATES = Object.freeze([
  {
    id: 'krea_trellis2',
    label: 'Krea → TRELLIS.2',
    shortLabel: 'TRELLIS.2',
    description: 'Single mesh-ready image → TRELLIS.2 textured mesh',
    defaultName: 'Krea → TRELLIS.2',
    imageModel: 'krea2_turbo_text_to_image',
    meshModel: 'trellis2_image_to_textured_mesh',
    promptOptions: STUDIO_MESH_READY_TEXT_TO_IMAGE_OPTIONS,
  },
  {
    id: 'krea_trellis_multiview',
    label: 'Krea → TRELLIS Multiview',
    shortLabel: 'Multiview',
    description:
      'Six orthographic views (shared seed) → TRELLIS multiview mesh',
    defaultName: 'Krea → TRELLIS Multiview',
    imageModel: 'krea2_turbo_text_to_image',
    meshModel: 'trellis_image_to_textured_mesh',
    promptOptions: STUDIO_MULTIVIEW_TEXT_TO_IMAGE_OPTIONS,
  },
]);

export const DEFAULT_STUDIO_TEMPLATE_ID = 'krea_trellis2';

export function getStudioTemplate(templateId) {
  return (
    STUDIO_TEMPLATES.find((t) => t.id === templateId) ||
    STUDIO_TEMPLATES.find((t) => t.id === DEFAULT_STUDIO_TEMPLATE_ID)
  );
}

function newId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}`;
}

/**
 * @param {string} templateId
 * @param {{ prompt?: string, projectName?: string }} [opts]
 */
export function createStudioProject(templateId = DEFAULT_STUDIO_TEMPLATE_ID, opts = {}) {
  const template = getStudioTemplate(templateId);
  const prompt = typeof opts.prompt === 'string' ? opts.prompt : '';
  const projectName =
    typeof opts.projectName === 'string' && opts.projectName.trim()
      ? opts.projectName.trim()
      : template.defaultName;

  const promptNode = {
    id: newId('n'),
    kind: 'text_prompt',
    label: STUDIO_NODE_KINDS.text_prompt.label,
    stage: 'prompt',
    status: 'ready',
    data: { prompt },
    position: { x: 40, y: 120 },
  };
  const imageNode = {
    id: newId('n'),
    kind: 'text_to_image',
    label: STUDIO_NODE_KINDS.text_to_image.label,
    stage: 'image',
    status: 'idle',
    data: {
      modelPreference: template.imageModel,
      promptOptions: { ...template.promptOptions },
      taskId: null,
      imageUrl: null,
    },
    position: { x: 320, y: 120 },
  };
  const meshNode = {
    id: newId('n'),
    kind: 'image_to_3d',
    label:
      template.id === 'krea_trellis_multiview'
        ? 'Image to 3D (Multiview)'
        : STUDIO_NODE_KINDS.image_to_3d.label,
    stage: 'mesh',
    status: 'idle',
    data: {
      modelPreference: template.meshModel,
      taskId: null,
      meshUrl: null,
      objectName: projectName,
    },
    position: { x: 600, y: 120 },
  };
  const rigNode = {
    id: newId('n'),
    kind: 'auto_rigging',
    label: STUDIO_NODE_KINDS.auto_rigging.label,
    stage: 'rig',
    status: 'idle',
    data: {
      modelPreference: STUDIO_NODE_KINDS.auto_rigging.defaultModel,
      rigMode: 'full',
      taskId: null,
      meshUrl: null,
      objectName: projectName,
    },
    position: { x: 880, y: 120 },
  };
  const exportNode = {
    id: newId('n'),
    kind: 'export_asset',
    label: STUDIO_NODE_KINDS.export_asset.label,
    stage: 'export',
    status: 'idle',
    data: { meshUrl: null },
    position: { x: 1160, y: 120 },
  };

  return {
    id: newId('proj'),
    name: projectName,
    templateId: template.id,
    createdAt: new Date().toISOString(),
    nodes: [promptNode, imageNode, meshNode, rigNode, exportNode],
    edges: [
      { id: newId('e'), source: promptNode.id, target: imageNode.id },
      { id: newId('e'), source: imageNode.id, target: meshNode.id },
      { id: newId('e'), source: meshNode.id, target: rigNode.id },
      { id: newId('e'), source: rigNode.id, target: exportNode.id },
    ],
  };
}

/**
 * Locked single-image pipeline: Krea 2 Turbo → TRELLIS.2.
 * @param {{ prompt?: string, projectName?: string }} [opts]
 */
export function createKreaTrellisTemplate(opts = {}) {
  return createStudioProject('krea_trellis2', opts);
}

/**
 * Orthographic turnaround pipeline: Krea ×6 → TRELLIS multiview.
 * @param {{ prompt?: string, projectName?: string }} [opts]
 */
export function createKreaTrellisMultiviewTemplate(opts = {}) {
  return createStudioProject('krea_trellis_multiview', opts);
}

export function getNodeKind(kind) {
  return STUDIO_NODE_KINDS[kind] || null;
}

export function getUpstreamNode(project, nodeId) {
  const edge = project.edges.find((e) => e.target === nodeId);
  if (!edge) return null;
  return project.nodes.find((n) => n.id === edge.source) || null;
}

export function getDownstreamNodes(project, nodeId) {
  const targets = project.edges.filter((e) => e.source === nodeId).map((e) => e.target);
  return project.nodes.filter((n) => targets.includes(n.id));
}

export function updateNode(project, nodeId, patch) {
  return {
    ...project,
    nodes: project.nodes.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            ...patch,
            data: patch.data ? { ...n.data, ...patch.data } : n.data,
          }
        : n,
    ),
  };
}

export function setPromptText(project, prompt) {
  const promptNode = project.nodes.find((n) => n.kind === 'text_prompt');
  if (!promptNode) return project;
  return updateNode(project, promptNode.id, {
    status: prompt.trim() ? 'ready' : 'idle',
    data: { prompt },
  });
}

export function getPromptText(project) {
  const promptNode = project.nodes.find((n) => n.kind === 'text_prompt');
  return promptNode?.data?.prompt ?? '';
}

export function getTextToImagePromptOptions(project) {
  const imageNode = project.nodes.find((n) => n.kind === 'text_to_image');
  const template = getStudioTemplate(project.templateId);
  return normalizeTextToImagePromptOptions(
    imageNode?.data?.promptOptions || template.promptOptions,
  );
}

export function setTextToImagePromptOptions(project, options) {
  const imageNode = project.nodes.find((n) => n.kind === 'text_to_image');
  if (!imageNode) return project;
  return updateNode(project, imageNode.id, {
    data: {
      promptOptions: normalizeTextToImagePromptOptions(options),
    },
  });
}

/** Ensure older localStorage projects map to the selectable template catalog. */
export function migrateStudioProject(project) {
  if (!project?.nodes) return project;
  let next = { ...project };

  if (!next.templateId || next.templateId === 'krea_trellis') {
    const imageNode = next.nodes.find((n) => n.kind === 'text_to_image');
    const looksMultiview = Boolean(imageNode?.data?.promptOptions?.all_orthographic_views);
    next = {
      ...next,
      templateId: looksMultiview ? 'krea_trellis_multiview' : 'krea_trellis2',
    };
  }

  const template = getStudioTemplate(next.templateId);
  const imageNode = next.nodes.find((n) => n.kind === 'text_to_image');
  if (imageNode && !imageNode.data?.promptOptions) {
    next = updateNode(next, imageNode.id, {
      data: {
        promptOptions: { ...template.promptOptions },
        modelPreference: imageNode.data?.modelPreference || template.imageModel,
      },
    });
  }

  const meshNode = next.nodes.find((n) => n.kind === 'image_to_3d');
  if (meshNode && !meshNode.data?.modelPreference) {
    next = updateNode(next, meshNode.id, {
      data: { modelPreference: template.meshModel },
    });
  }

  // Older projects: insert Auto Rigging between mesh and export.
  if (!next.nodes.some((n) => n.kind === 'auto_rigging')) {
    const exportNode = next.nodes.find((n) => n.kind === 'export_asset');
    const mesh = next.nodes.find((n) => n.kind === 'image_to_3d');
    if (mesh && exportNode) {
      const rigNode = {
        id: newId('n'),
        kind: 'auto_rigging',
        label: STUDIO_NODE_KINDS.auto_rigging.label,
        stage: 'rig',
        status: 'idle',
        data: {
          modelPreference: STUDIO_NODE_KINDS.auto_rigging.defaultModel,
          rigMode: 'full',
          taskId: null,
          meshUrl: null,
          objectName: next.name || mesh.data?.objectName || 'studio_asset',
        },
        position: {
          x: ((mesh.position?.x || 600) + (exportNode.position?.x || 1160)) / 2,
          y: mesh.position?.y || 120,
        },
      };
      next = {
        ...next,
        nodes: [
          ...next.nodes.filter((n) => n.id !== exportNode.id),
          rigNode,
          exportNode,
        ],
        edges: [
          ...next.edges.filter(
            (e) => !(e.source === mesh.id && e.target === exportNode.id),
          ),
          { id: newId('e'), source: mesh.id, target: rigNode.id },
          { id: newId('e'), source: rigNode.id, target: exportNode.id },
        ],
      };
    }
  }

  return next;
}

/** Group nodes by kanban stage (order preserved from STUDIO_STAGES). */
export function groupNodesByStage(project) {
  const groups = STUDIO_STAGES.map((stage) => ({
    ...stage,
    nodes: project.nodes.filter((n) => n.stage === stage.id),
  }));
  return groups;
}

/** Linear run order for the locked template (topological by edges). */
export function getRunnablePipelineOrder(project) {
  const kindOrder = ['text_to_image', 'image_to_3d', 'auto_rigging'];
  return kindOrder
    .map((kind) => project.nodes.find((n) => n.kind === kind))
    .filter(Boolean);
}

export function toReactFlowElements(project) {
  const nodes = project.nodes.map((n) => ({
    id: n.id,
    type: 'studio',
    position: n.position || { x: 0, y: 0 },
    data: {
      kind: n.kind,
      label: n.label,
      stage: n.stage,
      status: n.status,
      payload: n.data,
    },
  }));
  const edges = project.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: true,
  }));
  return { nodes, edges };
}

const STORAGE_KEY = 'opennexus.studio.project.v1';

export function saveProjectToStorage(project) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

export function loadProjectFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.nodes || !parsed?.edges) return null;
    return migrateStudioProject(parsed);
  } catch {
    return null;
  }
}
