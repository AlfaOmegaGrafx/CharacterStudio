import { describe, it, expect } from 'vitest';
import {
  createKreaTrellisTemplate,
  createKreaTrellisMultiviewTemplate,
  getPromptText,
  setPromptText,
  getTextToImagePromptOptions,
  setTextToImagePromptOptions,
  getUpstreamNode,
  getRunnablePipelineOrder,
  groupNodesByStage,
  toReactFlowElements,
  STUDIO_NODE_KINDS,
  updateNode,
} from '../library/studioGraph.js';

describe('studioGraph', () => {
  it('creates locked Krea → TRELLIS.2 template with five stages (incl. auto-rig)', () => {
    const project = createKreaTrellisTemplate({ prompt: 'a red cube' });
    expect(project.templateId).toBe('krea_trellis2');
    expect(project.nodes).toHaveLength(5);
    expect(project.edges).toHaveLength(4);
    expect(getPromptText(project)).toBe('a red cube');

    const kinds = project.nodes.map((n) => n.kind);
    expect(kinds).toEqual([
      'text_prompt',
      'text_to_image',
      'image_to_3d',
      'auto_rigging',
      'export_asset',
    ]);

    const t2i = project.nodes.find((n) => n.kind === 'text_to_image');
    expect(t2i.data.modelPreference).toBe(
      STUDIO_NODE_KINDS.text_to_image.defaultModel,
    );
    expect(t2i.data.promptOptions.all_orthographic_views).toBe(false);
    const i23 = project.nodes.find((n) => n.kind === 'image_to_3d');
    expect(i23.data.modelPreference).toBe(
      STUDIO_NODE_KINDS.image_to_3d.defaultModel,
    );
    const rig = project.nodes.find((n) => n.kind === 'auto_rigging');
    expect(rig.data.modelPreference).toBe('skintokens_auto_rig');
  });

  it('creates separate multiview template with TRELLIS v1 mesh model', () => {
    const project = createKreaTrellisMultiviewTemplate({ prompt: 'dragon knight' });
    expect(project.templateId).toBe('krea_trellis_multiview');
    const opts = getTextToImagePromptOptions(project);
    expect(opts.all_orthographic_views).toBe(true);
    const mesh = project.nodes.find((n) => n.kind === 'image_to_3d');
    expect(mesh.data.modelPreference).toBe('trellis_image_to_textured_mesh');
  });

  it('updates prompt on text_prompt node', () => {
    let project = createKreaTrellisTemplate();
    project = setPromptText(project, 'samurai helmet');
    expect(getPromptText(project)).toBe('samurai helmet');
  });

  it('resolves upstream for image_to_3d as text_to_image', () => {
    const project = createKreaTrellisTemplate();
    const mesh = project.nodes.find((n) => n.kind === 'image_to_3d');
    const upstream = getUpstreamNode(project, mesh.id);
    expect(upstream?.kind).toBe('text_to_image');
  });

  it('runnable order is text_to_image then image_to_3d then auto_rigging', () => {
    const project = createKreaTrellisTemplate();
    const order = getRunnablePipelineOrder(project);
    expect(order.map((n) => n.kind)).toEqual([
      'text_to_image',
      'image_to_3d',
      'auto_rigging',
    ]);
  });

  it('groups nodes into kanban stages', () => {
    const project = createKreaTrellisTemplate();
    const groups = groupNodesByStage(project);
    expect(groups.map((g) => g.id)).toEqual([
      'prompt',
      'image',
      'mesh',
      'rig',
      'export',
    ]);
    expect(groups.every((g) => g.nodes.length === 1)).toBe(true);
  });

  it('maps to React Flow elements', () => {
    const project = createKreaTrellisTemplate();
    const { nodes, edges } = toReactFlowElements(project);
    expect(nodes).toHaveLength(5);
    expect(edges).toHaveLength(4);
    expect(nodes[0].type).toBe('studio');
  });

  it('updateNode merges data without dropping fields', () => {
    const project = createKreaTrellisTemplate();
    const image = project.nodes.find((n) => n.kind === 'text_to_image');
    const next = updateNode(project, image.id, {
      status: 'completed',
      data: { imageUrl: '/api/v1/system/jobs/abc/download' },
    });
    const updated = next.nodes.find((n) => n.id === image.id);
    expect(updated.status).toBe('completed');
    expect(updated.data.modelPreference).toBe('krea2_turbo_text_to_image');
    expect(updated.data.imageUrl).toBe('/api/v1/system/jobs/abc/download');
  });

  it('defaults text-to-image prompt options for mesh-ready framing', () => {
    const project = createKreaTrellisTemplate({ prompt: 'dragon knight' });
    const opts = getTextToImagePromptOptions(project);
    expect(opts.full_body).toBe(true);
    expect(opts.t_pose).toBe(true);
    expect(opts.remove_background).toBe(true);
    expect(opts.camera_view).toBe('front');
    expect(opts.all_orthographic_views).toBe(false);
  });

  it('setTextToImagePromptOptions updates image node', () => {
    let project = createKreaTrellisTemplate();
    project = setTextToImagePromptOptions(project, {
      full_body: true,
      a_pose: true,
      t_pose: false,
      remove_background: true,
      camera_view: 'side_left',
    });
    const opts = getTextToImagePromptOptions(project);
    expect(opts.a_pose).toBe(true);
    expect(opts.t_pose).toBe(false);
    expect(opts.camera_view).toBe('side_left');
  });
});
