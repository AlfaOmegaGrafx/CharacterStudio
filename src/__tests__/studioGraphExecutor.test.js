import { describe, it, expect, vi } from 'vitest';
import { createKreaTrellisMultiviewTemplate, createKreaTrellisTemplate, setPromptText } from '../library/studioGraph.js';
import { runStudioPipeline, fetchImageAsFile } from '../library/studioGraphExecutor.js';

describe('studioGraphExecutor', () => {
  it('fetchImageAsFile builds a File from a successful fetch', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => blob,
      })),
    );

    const file = await fetchImageAsFile(
      '/api/v1/system/jobs/abc/download',
      'http://127.0.0.1:7842',
      'out.png',
    );
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('out.png');
    vi.unstubAllGlobals();
  });

  it('runStudioPipeline single-image TRELLIS.2 template runs one Krea job', async () => {
    let project = createKreaTrellisTemplate({ prompt: 'red cube', projectName: 'Cube' });
    project = setPromptText(project, 'red cube');

    const createAndStartTask = vi
      .fn()
      .mockResolvedValueOnce({
        job_id: 'img1',
        feature: 'text_to_image',
        status: 'completed',
      })
      .mockResolvedValueOnce({
        job_id: 'mesh1',
        feature: 'image_to_textured_mesh',
        mesh_url: '/api/v1/system/jobs/mesh1/download',
        status: 'completed',
      });
    const listTasks = vi.fn(() => [
      {
        id: 'text-to-image_1',
        type: 'text-to-image',
        job_id: 'img1',
        result: { job_id: 'img1', feature: 'text_to_image' },
      },
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(['x'], { type: 'image/png' }),
      })),
    );

    const next = await runStudioPipeline(
      project,
      {
        createAndStartTask,
        listTasks,
        apiEndpoint: 'http://127.0.0.1:7842',
      },
      { until: 'image_to_3d' },
    );
    expect(createAndStartTask).toHaveBeenCalledTimes(2);
    expect(createAndStartTask.mock.calls[0][0].type).toBe('text-to-image');
    expect(createAndStartTask.mock.calls[1][0].type).toBe('image-to-3d');
    expect(createAndStartTask.mock.calls[1][0].options.use_multiview_mesh).toBeFalsy();
    expect(next.nodes.find((n) => n.kind === 'image_to_3d').data.modelPreference).toBe(
      'trellis2_image_to_textured_mesh',
    );
    vi.unstubAllGlobals();
  });

  it('runStudioPipeline generates 6 orthographic views then multiview mesh', async () => {
    let project = createKreaTrellisMultiviewTemplate({
      prompt: 'dragon knight',
      projectName: 'Knight',
    });
    project = setPromptText(project, 'dragon knight');

    let jobCounter = 0;
    const createAndStartTask = vi.fn(async (taskData) => {
      jobCounter += 1;
      const jobId = `job_${jobCounter}`;
      if (taskData.type === 'text-to-image') {
        return { job_id: jobId, feature: 'text_to_image', status: 'completed' };
      }
      return {
        job_id: jobId,
        feature: 'image_to_textured_mesh',
        mesh_url: `/api/v1/system/jobs/${jobId}/download`,
        status: 'completed',
      };
    });

    const listTasks = vi.fn(() =>
      Array.from({ length: jobCounter }, (_, i) => ({
        id: `text-to-image_${i + 1}`,
        type: 'text-to-image',
        job_id: `job_${i + 1}`,
        result: { job_id: `job_${i + 1}`, feature: 'text_to_image' },
      })),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(['x'], { type: 'image/png' }),
      })),
    );

    const next = await runStudioPipeline(
      project,
      {
        createAndStartTask,
        listTasks,
        apiEndpoint: 'http://127.0.0.1:7842',
      },
      { until: 'image_to_3d' },
    );

    // 6 Krea views + 1 TRELLIS
    expect(createAndStartTask).toHaveBeenCalledTimes(7);
    const imageCalls = createAndStartTask.mock.calls.filter((c) => c[0].type === 'text-to-image');
    expect(imageCalls).toHaveLength(6);
    const seeds = imageCalls.map((c) => c[0].options.model_parameters?.seed);
    expect(new Set(seeds).size).toBe(1);
    expect(seeds[0]).toEqual(expect.any(Number));
    expect(imageCalls.every((c) => c[0].prompt.includes('character turnaround'))).toBe(true);

    const meshCall = createAndStartTask.mock.calls.find((c) => c[0].type === 'image-to-3d');
    expect(meshCall[0].options.use_multiview_mesh).toBe(true);
    expect(meshCall[0].options.model_preference).toBe('trellis_image_to_textured_mesh');
    expect(meshCall[0].options.reference_image_files).toHaveLength(5);
    expect(meshCall[0].imageFile).toBeInstanceOf(File);

    const imageNode = next.nodes.find((n) => n.kind === 'text_to_image');
    expect(imageNode.status).toBe('completed');
    expect(imageNode.data.views).toHaveLength(6);
    expect(imageNode.data.multiviewSeed).toEqual(expect.any(Number));

    vi.unstubAllGlobals();
  });

  it('runStudioPipeline until text_to_image skips mesh', async () => {
    let project = createKreaTrellisTemplate({ prompt: 'red cube', projectName: 'Cube' });
    project = setPromptText(project, 'red cube');

    const createAndStartTask = vi.fn().mockResolvedValueOnce({
      job_id: 'img1',
      feature: 'text_to_image',
      status: 'completed',
    });
    const listTasks = vi.fn(() => [
      {
        id: 'text-to-image_1',
        type: 'text-to-image',
        job_id: 'img1',
        result: { job_id: 'img1', feature: 'text_to_image' },
      },
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(['x'], { type: 'image/png' }),
      })),
    );

    await runStudioPipeline(
      project,
      { createAndStartTask, listTasks, apiEndpoint: 'http://127.0.0.1:7842' },
      { until: 'text_to_image' },
    );
    expect(createAndStartTask).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('runStudioPipeline continues to auto_rigging after mesh', async () => {
    let project = createKreaTrellisTemplate({ prompt: 'red cube', projectName: 'Cube' });
    project = setPromptText(project, 'red cube');

    const createAndStartTask = vi
      .fn()
      .mockResolvedValueOnce({
        job_id: 'img1',
        feature: 'text_to_image',
        status: 'completed',
      })
      .mockResolvedValueOnce({
        job_id: 'mesh1',
        feature: 'image_to_textured_mesh',
        mesh_url: '/api/v1/system/jobs/mesh1/download',
        status: 'completed',
      })
      .mockResolvedValueOnce({
        job_id: 'rig1',
        feature: 'auto_rig',
        mesh_url: '/api/v1/system/jobs/rig1/download',
        status: 'completed',
      });
    const listTasks = vi.fn(() => [
      {
        id: 'text-to-image_1',
        type: 'text-to-image',
        job_id: 'img1',
        result: { job_id: 'img1', feature: 'text_to_image' },
      },
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(['x'], { type: 'model/gltf-binary' }),
      })),
    );

    const next = await runStudioPipeline(project, {
      createAndStartTask,
      listTasks,
      apiEndpoint: 'http://127.0.0.1:7842',
    });
    expect(createAndStartTask).toHaveBeenCalledTimes(3);
    expect(createAndStartTask.mock.calls[2][0].type).toBe('auto-rigging');
    expect(createAndStartTask.mock.calls[2][0].options.model_preference).toBe(
      'skintokens_auto_rig',
    );
    expect(createAndStartTask.mock.calls[2][1]).toBeInstanceOf(File);
    expect(next.nodes.find((n) => n.kind === 'auto_rigging').status).toBe('completed');
    expect(next.nodes.find((n) => n.kind === 'export_asset').data.meshUrl).toContain('rig1');
    vi.unstubAllGlobals();
  });
});
