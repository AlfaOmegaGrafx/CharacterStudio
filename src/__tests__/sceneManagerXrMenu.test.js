import { describe, expect, it, vi } from 'vitest';
import * as THREE from '../library/three.js';
import {
  SceneManagerXrMenu,
  XR_MENU_PANEL_PITCH,
  XR_MENU_PANEL_YAW,
  XR_MENU_GRIP_FORWARD_M,
  XR_MENU_GRIP_DOWN_M,
  XR_MENU_BOTTOM_LIFT_M,
  XR_MENU_BG_OPACITY,
  XR_MENU_PANEL_H,
  XR_MENU_TAB_ANIMATION,
  XR_MENU_TAB_AI,
  XR_MENU_TAB_ANIM_AI,
  XR_MENU_TAB_SCENE,
  XR_MENU_TAB_STUDIO,
} from '../library/sceneManagerXrMenu.js';
import { XR_AVATAR_VIEW_THIRD_PERSON } from '../library/sceneManagerXrAvatarView.js';
import {
  SceneManagerXrLocomotion,
  XR_LOCOMOTION_MODE_AVATAR,
  XR_LOCOMOTION_MODE_VIEWPOINT,
} from '../library/sceneManagerXrLocomotion.js';
import {
  SceneManagerXrMeasure,
  formatMeasureLength,
  lockMeasureAxis,
  XR_MEASURE_AXIS_HORIZONTAL,
  XR_MEASURE_AXIS_VERTICAL,
} from '../library/sceneManagerXrMeasure.js';

describe('SceneManagerXrMenu', () => {
  it('attaches to left grip with pitch up and runs toggle actions', () => {
    const scene = new THREE.Scene();
    const avatarView = {
      mode: XR_AVATAR_VIEW_THIRD_PERSON,
      toggleMode: vi.fn(function toggle() {
        this.mode = 'first_person';
      }),
    };
    const locomotion = new SceneManagerXrLocomotion({ emit: vi.fn() });
    const measure = new SceneManagerXrMeasure({ scene, emit: vi.fn() });

    const menu = new SceneManagerXrMenu(
      { scene, camera: new THREE.PerspectiveCamera() },
      avatarView,
      locomotion,
      measure,
    );
    menu.open = true;
    menu._createPanel();

    expect(XR_MENU_PANEL_YAW).toBe(0);
    expect(XR_MENU_PANEL_PITCH).toBeCloseTo(-Math.PI / 4);
    expect(menu._panelContent?.rotation.y).toBeCloseTo(0);
    expect(menu._panelContent?.rotation.x).toBeCloseTo(-Math.PI / 4);

    const left = {
      gripPosition: new THREE.Vector3(0.2, 1.2, -0.3),
      gripQuaternion: new THREE.Quaternion(),
    };
    menu._updatePanelPose(left);
    // Menu sits on the controller: forward + slight down in grip-local space.
    expect(XR_MENU_GRIP_DOWN_M).toBeCloseTo(0.18);
    expect(XR_MENU_BOTTOM_LIFT_M).toBeCloseTo(
      -((-XR_MENU_PANEL_H / 2) * Math.cos(XR_MENU_PANEL_PITCH)),
      5,
    );
    expect(XR_MENU_BOTTOM_LIFT_M).toBeGreaterThan(0);
    expect(menu._panelContent?.position.y).toBeCloseTo(XR_MENU_BOTTOM_LIFT_M, 5);
    expect(menu._group.position.y).toBeCloseTo(
      left.gripPosition.y - XR_MENU_GRIP_DOWN_M,
      5,
    );
    expect(menu._group.position.z).toBeCloseTo(
      left.gripPosition.z - XR_MENU_GRIP_FORWARD_M,
      5,
    );

    const bg = menu._panelContent.children.find((c) => c.name === 'XRMenuBackground');
    expect(bg.geometry.parameters.width).toBeGreaterThan(0.5);
    expect(bg.material.transparent).toBe(true);
    expect(bg.material.opacity).toBeCloseTo(XR_MENU_BG_OPACITY);
    expect(XR_MENU_BG_OPACITY).toBeCloseTo(0.25);

    const closeBtn = menu._hitTargets.find((m) => m.name === 'XRMenuClose');
    expect(closeBtn).toBeTruthy();
    const mainBtns = menu._hitTargets.filter(
      (m) =>
        m.name !== 'XRMenuBackground' &&
        m.name !== 'XRMenuBackPlate' &&
        !String(m.userData.xrMenuAction || '').startsWith('tab-'),
    );
    const minMainY = Math.min(...mainBtns.map((m) => m.position.y));
    expect(closeBtn.position.y).toBeCloseTo(minMainY, 5);
    expect(closeBtn.position.x).toBeLessThan(0);

    const tabs = menu._hitTargets.filter((m) =>
      String(m.userData.xrMenuAction || '').startsWith('tab-'),
    );
    expect(tabs.length).toBe(5);
    expect(tabs.every((t) => t.position.x > 0)).toBe(true);
    const rowH = mainBtns[0].geometry.parameters.height;
    expect(mainBtns.every((b) => b.geometry.parameters.height === rowH)).toBe(true);
    expect(tabs.every((t) => t.geometry.parameters.height === rowH)).toBe(true);
    const mainW = mainBtns[0].geometry.parameters.width;
    expect(mainBtns.every((b) => b.geometry.parameters.width === mainW)).toBe(true);

    expect(menu._runMenuAction('toggle-view')).toBe(true);
    expect(avatarView.toggleMode).toHaveBeenCalled();

    locomotion.setMode(XR_LOCOMOTION_MODE_VIEWPOINT);
    expect(menu._runMenuAction('toggle-locomotion')).toBe(true);
    expect(locomotion.mode).toBe(XR_LOCOMOTION_MODE_AVATAR);

    expect(menu._runMenuAction('toggle-measure')).toBe(true);
    expect(measure.active).toBe(true);

    menu._runMenuAction('close');
    expect(menu.open).toBe(false);
    expect(menu._group).toBeNull();
  });

  it('toggles Move on left stick click even when the menu is closed', () => {
    const locomotion = new SceneManagerXrLocomotion({ emit: vi.fn() });
    locomotion.setMode(XR_LOCOMOTION_MODE_VIEWPOINT);
    const menu = new SceneManagerXrMenu(
      { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() },
      { mode: XR_AVATAR_VIEW_THIRD_PERSON, toggleMode: vi.fn() },
      locomotion,
    );
    expect(menu.open).toBe(false);

    const mkLeft = (stickPressed) => ({
      handedness: 'left',
      connected: true,
      inputSource: {
        gamepad: {
          buttons: [
            {},
            {},
            {},
            { pressed: stickPressed, value: stickPressed ? 1 : 0 },
            { pressed: false, value: 0 },
            { pressed: false, value: 0 },
          ],
        },
      },
    });

    menu.update([mkLeft(false)]);
    menu.update([mkLeft(true)]);
    expect(locomotion.mode).toBe(XR_LOCOMOTION_MODE_AVATAR);

    menu.update([mkLeft(false)]);
    menu.update([mkLeft(true)]);
    expect(locomotion.mode).toBe(XR_LOCOMOTION_MODE_VIEWPOINT);
  });

  it('pairs View / Move / Measure controls with their status rows', () => {
    const scene = new THREE.Scene();
    const menu = new SceneManagerXrMenu(
      { scene, camera: new THREE.PerspectiveCamera() },
      { mode: XR_AVATAR_VIEW_THIRD_PERSON, toggleMode: vi.fn() },
      new SceneManagerXrLocomotion({ emit: vi.fn() }),
      new SceneManagerXrMeasure({ scene, emit: vi.fn() }),
    );
    menu.open = true;
    menu._createPanel();

    const named = menu._hitTargets.filter((m) => m.name?.startsWith('XRMenu'));
    const viewIdx = menu._hitTargets.indexOf(menu._statusLabel);
    const locoIdx = menu._hitTargets.indexOf(menu._locomotionLabel);
    const measureIdx = menu._hitTargets.indexOf(menu._measureLabel);

    // Status sits immediately after its control (higher index = lower on panel).
    expect(viewIdx).toBeGreaterThan(-1);
    expect(locoIdx).toBeGreaterThan(viewIdx);
    expect(measureIdx).toBeGreaterThan(locoIdx);
    expect(menu._statusLabel.position.y).toBeGreaterThan(menu._locomotionLabel.position.y);
    expect(menu._locomotionLabel.position.y).toBeGreaterThan(menu._measureLabel.position.y);
    expect(named.length).toBeGreaterThanOrEqual(3);
  });

  it('toggles view on left X even when the menu is closed', () => {
    const avatarView = {
      mode: XR_AVATAR_VIEW_THIRD_PERSON,
      toggleMode: vi.fn(),
    };
    const menu = new SceneManagerXrMenu(
      { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() },
      avatarView,
      new SceneManagerXrLocomotion({ emit: vi.fn() }),
    );
    expect(menu.open).toBe(false);

    const mkLeft = (xPressed) => ({
      handedness: 'left',
      connected: true,
      inputSource: {
        gamepad: {
          buttons: [
            {},
            {},
            {},
            {},
            { pressed: xPressed, value: xPressed ? 1 : 0 },
            { pressed: false, value: 0 },
          ],
        },
      },
    });

    menu.update([mkLeft(false)]);
    menu.update([mkLeft(true)]);
    expect(avatarView.toggleMode).toHaveBeenCalledTimes(1);

    menu.update([mkLeft(false)]);
    menu.update([mkLeft(true)]);
    expect(avatarView.toggleMode).toHaveBeenCalledTimes(2);
  });

  it('ray-select fires menu action when trigger hits a row', () => {
    const scene = new THREE.Scene();
    const avatarView = {
      mode: XR_AVATAR_VIEW_THIRD_PERSON,
      toggleMode: vi.fn(),
    };
    const locomotion = new SceneManagerXrLocomotion({ emit: vi.fn() });
    const menu = new SceneManagerXrMenu(
      { scene, camera: new THREE.PerspectiveCamera() },
      avatarView,
      locomotion,
    );
    menu.open = true;
    menu._createPanel();
    menu._group.position.set(0, 1.2, -0.4);
    menu._group.quaternion.identity();
    menu._group.updateMatrixWorld(true);

    const row = menu._hitTargets.find((m) => m.userData.xrMenuAction === 'toggle-view');
    expect(row).toBeTruthy();
    const worldPos = new THREE.Vector3();
    row.getWorldPosition(worldPos);
    const origin = worldPos.clone().add(new THREE.Vector3(0, 0, 0.2));
    const dir = worldPos.clone().sub(origin).normalize();

    const hit = menu.raycast({
      rayOrigin: origin,
      rayDirection: dir,
    });
    expect(hit).toBeTruthy();
    expect(hit.distance).toBeLessThan(0.5);

    const consumed = menu.handlePointerSelect([
      {
        handedness: 'right',
        selectStart: true,
        rayOrigin: origin,
        rayDirection: dir,
      },
    ]);

    expect(consumed).toBe(true);
    expect(avatarView.toggleMode).toHaveBeenCalled();
  });

  it('prefers a labeled row over the background when both are hit (RayInteractable-style)', () => {
    const scene = new THREE.Scene();
    const menu = new SceneManagerXrMenu(
      { scene, camera: new THREE.PerspectiveCamera() },
      { mode: XR_AVATAR_VIEW_THIRD_PERSON, toggleMode: vi.fn() },
      new SceneManagerXrLocomotion({ emit: vi.fn() }),
    );
    menu.open = true;
    menu._createPanel();
    menu._group.position.set(0, 1.2, -0.4);
    menu._group.quaternion.identity();
    menu._group.updateMatrixWorld(true);

    const row = menu._hitTargets.find((m) => m.userData.xrMenuAction === 'toggle-locomotion');
    const worldPos = new THREE.Vector3();
    row.getWorldPosition(worldPos);
    const origin = worldPos.clone().add(new THREE.Vector3(0, 0, 0.25));
    const dir = worldPos.clone().sub(origin).normalize();

    const hit = menu.raycast({ rayOrigin: origin, rayDirection: dir });
    expect(hit?.action).toBe('toggle-locomotion');
    expect(hit?.object?.name).not.toBe('XRMenuBackground');
  });

  it('keeps all menu meshes inside the panel background bounds', () => {
    const scene = new THREE.Scene();
    const menu = new SceneManagerXrMenu(
      { scene, camera: new THREE.PerspectiveCamera() },
      { mode: XR_AVATAR_VIEW_THIRD_PERSON, toggleMode: vi.fn() },
      new SceneManagerXrLocomotion({ emit: vi.fn() }),
      new SceneManagerXrMeasure({ scene, emit: vi.fn() }),
    );
    menu.open = true;
    menu._createPanel();

    const bg = menu._panelContent.children.find((c) => c.name === 'XRMenuBackground');
    expect(bg.isMesh).toBe(true);
    const halfW = bg.geometry.parameters.width / 2;
    const halfH = bg.geometry.parameters.height / 2;

    for (const mesh of menu._hitTargets) {
      if (mesh === bg || mesh.name === 'XRMenuBackPlate') continue;
      const top = mesh.position.y + mesh.geometry.parameters.height / 2;
      const bottom = mesh.position.y - mesh.geometry.parameters.height / 2;
      expect(top).toBeLessThanOrEqual(halfH + 1e-6);
      expect(bottom).toBeGreaterThanOrEqual(-halfH - 1e-6);
      expect(Math.abs(mesh.position.x)).toBeLessThanOrEqual(halfW);
    }
  });

  it('switches to Animation tab and runs play/pause / next / prev', async () => {
    const scene = new THREE.Scene();
    const animationManager = {
      isPaused: vi.fn(() => false),
      pause: vi.fn(),
      play: vi.fn(),
      setSpeed: vi.fn(),
      setTime: vi.fn(),
      getCurrentAnimationName: vi.fn(() => 'Idle'),
      loadNextAnimation: vi.fn(async () => {}),
      loadPreviousAnimation: vi.fn(async () => {}),
      triggerPrimarySync: vi.fn(),
    };
    const menu = new SceneManagerXrMenu(
      {
        scene,
        camera: new THREE.PerspectiveCamera(),
        getAnimationManager: () => animationManager,
      },
      { mode: XR_AVATAR_VIEW_THIRD_PERSON, toggleMode: vi.fn() },
      new SceneManagerXrLocomotion({ emit: vi.fn() }),
    );
    menu.open = true;
    menu._createPanel();
    expect(menu.tab).toBe(XR_MENU_TAB_SCENE);
    expect(menu._hitTargets.some((m) => m.userData.xrMenuAction === 'tab-animation')).toBe(true);

    expect(menu._runMenuAction('tab-animation')).toBe(true);
    expect(menu.tab).toBe(XR_MENU_TAB_ANIMATION);
    expect(menu._hitTargets.some((m) => m.userData.xrMenuAction === 'anim-play-pause')).toBe(true);
    expect(menu._hitTargets.some((m) => m.userData.xrMenuAction === 'anim-next')).toBe(true);
    expect(menu._hitTargets.some((m) => m.userData.xrMenuAction === 'anim-prev')).toBe(true);

    expect(menu._runMenuAction('anim-play-pause')).toBe(true);
    expect(animationManager.pause).toHaveBeenCalled();
    expect(animationManager.setSpeed).toHaveBeenCalledWith(0);

    expect(menu._runMenuAction('anim-next')).toBe(true);
    await vi.waitFor(() => {
      expect(animationManager.loadNextAnimation).toHaveBeenCalled();
      expect(animationManager.triggerPrimarySync).toHaveBeenCalled();
    });

    expect(menu._runMenuAction('anim-prev')).toBe(true);
    await vi.waitFor(() => {
      expect(animationManager.loadPreviousAnimation).toHaveBeenCalled();
    });

    expect(menu._runMenuAction('tab-scene')).toBe(true);
    expect(menu.tab).toBe(XR_MENU_TAB_SCENE);
    expect(menu._hitTargets.some((m) => m.userData.xrMenuAction === 'toggle-view')).toBe(true);
  });

  it('exposes AI, Motion, and Studio tabs with XR-safe actions', async () => {
    const scene = new THREE.Scene();
    const createAndStartTask = vi.fn(async (data) => ({ ok: true, type: data.type }));
    const getAllTasks = vi.fn(() => [
      {
        id: 't1',
        type: 'text-to-3d',
        status: 'completed',
        name: 'Hero',
        result: { mesh_url: 'https://example.com/hero.glb' },
        completedAt: 2,
      },
    ]);
    const getTaskStats = vi.fn(() => ({ running: 0, completed: 1, failed: 0 }));
    const getTasksByType = vi.fn(() => []);
    const loadRandomTraits = vi.fn(async () => {});
    const playEmotion = vi.fn();
    const downloadVRM = vi.fn();

    const menu = new SceneManagerXrMenu(
      {
        scene,
        camera: new THREE.PerspectiveCamera(),
        getXrTaskApi: () => ({
          createAndStartTask,
          getAllTasks,
          getTaskStats,
          getTasksByType,
          getApiEndpoint: () => '',
        }),
        getCharacterManager: () => ({
          loadRandomTraits,
          downloadVRM,
          emotionManager: {
            playEmotion,
            availableEmotions: ['happy', 'angry'],
          },
        }),
      },
      { mode: XR_AVATAR_VIEW_THIRD_PERSON, toggleMode: vi.fn() },
      new SceneManagerXrLocomotion({ emit: vi.fn() }),
    );
    menu.open = true;
    menu._createPanel();

    expect(menu._hitTargets.some((m) => m.userData.xrMenuAction === 'tab-ai')).toBe(true);
    expect(menu._hitTargets.some((m) => m.userData.xrMenuAction === 'tab-anim-ai')).toBe(true);
    expect(menu._hitTargets.some((m) => m.userData.xrMenuAction === 'tab-studio')).toBe(true);

    expect(menu._runMenuAction('tab-ai')).toBe(true);
    expect(menu.tab).toBe(XR_MENU_TAB_AI);
    expect(menu._hitTargets.some((m) => m.userData.xrMenuAction === 'ai-load-latest')).toBe(true);
    expect(menu._hitTargets.some((m) => m.userData.xrMenuAction === 'ai-t3d-hero')).toBe(true);

    const loadSpy = vi.fn();
    window.addEventListener('loadModelFromUrl', loadSpy);
    expect(menu._runMenuAction('ai-load-latest')).toBe(true);
    await vi.waitFor(() => {
      expect(loadSpy).toHaveBeenCalled();
    });
    window.removeEventListener('loadModelFromUrl', loadSpy);

    expect(menu._runMenuAction('ai-t3d-hero')).toBe(true);
    await vi.waitFor(() => {
      expect(createAndStartTask).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'text-to-3d' }),
      );
    });

    expect(menu._runMenuAction('tab-anim-ai')).toBe(true);
    expect(menu.tab).toBe(XR_MENU_TAB_ANIM_AI);
    expect(menu._hitTargets.some((m) => m.userData.xrMenuAction === 'anim-ai-wave')).toBe(true);
    expect(menu._runMenuAction('anim-ai-wave')).toBe(true);
    await vi.waitFor(() => {
      expect(createAndStartTask).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'text-to-motion' }),
      );
    });

    expect(menu._runMenuAction('tab-studio')).toBe(true);
    expect(menu.tab).toBe(XR_MENU_TAB_STUDIO);
    expect(menu._runMenuAction('studio-randomize')).toBe(true);
    await vi.waitFor(() => {
      expect(loadRandomTraits).toHaveBeenCalled();
    });
    expect(menu._runMenuAction('studio-emotion')).toBe(true);
    expect(playEmotion).toHaveBeenCalledWith('happy', undefined, false, 1);
    expect(menu._runMenuAction('studio-export-vrm')).toBe(true);
    expect(downloadVRM).toHaveBeenCalled();
  });
});

describe('SceneManagerXrMeasure', () => {
  it('locks horizontal/vertical and formats units', () => {
    const start = new THREE.Vector3(0, 1, 0);
    const end = new THREE.Vector3(2, 3, 4);
    const h = lockMeasureAxis(start, end, XR_MEASURE_AXIS_HORIZONTAL);
    expect(h.y).toBeCloseTo(1);
    expect(h.x).toBeCloseTo(2);
    const v = lockMeasureAxis(start, end, XR_MEASURE_AXIS_VERTICAL);
    expect(v.x).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(3);

    expect(formatMeasureLength(1, 'm')).toBe('1.000 m');
    expect(formatMeasureLength(1, 'ft')).toMatch(/3\.28/);
  });

  it('records true_meters after start+end', () => {
    const measure = new SceneManagerXrMeasure({ scene: new THREE.Scene(), emit: vi.fn() });
    measure.toggleActive();
    measure.placePoint(new THREE.Vector3(0, 0, 0));
    measure.placePoint(new THREE.Vector3(2, 5, 0));
    expect(measure.lastMeters).toBeCloseTo(2);
    expect(measure.active).toBe(true);
  });
});
