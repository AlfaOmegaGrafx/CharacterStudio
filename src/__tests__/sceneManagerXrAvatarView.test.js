import { describe, expect, it, vi } from 'vitest';
import * as THREE from '../library/three.js';
import {
  SceneManagerXrAvatarView,
  XR_AVATAR_VIEW_FIRST_PERSON,
  XR_AVATAR_VIEW_THIRD_PERSON,
  THIRD_PERSON_BEHIND_M,
  getAvatarHeadWorldPosition,
} from '../library/sceneManagerXrAvatarView.js';
import {
  SceneManagerXrLocomotion,
  XR_LOCOMOTION_MODE_AVATAR,
  XR_LOCOMOTION_MODE_VIEWPOINT,
} from '../library/sceneManagerXrLocomotion.js';

describe('SceneManagerXrAvatarView', () => {
  it('defaults to third person with avatar visible on session start', () => {
    const playerRoot = new THREE.Group();
    playerRoot.visible = true;
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1.6, -1);

    const sceneManager = {
      playerRoot,
      currentModel: new THREE.Object3D(),
      camera,
      emit: vi.fn(),
    };

    const view = new SceneManagerXrAvatarView(sceneManager);
    view.onSessionStart({ isVR: true });

    expect(view.mode).toBe(XR_AVATAR_VIEW_THIRD_PERSON);
    expect(playerRoot.visible).toBe(true);
  });

  it('applyEntryStandoff places avatar in front of the headset', () => {
    const root = new THREE.Group();
    const playerRoot = new THREE.Group();
    root.add(playerRoot);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1.6, -1);
    camera.updateMatrixWorld(true);

    const sceneManager = {
      playerRoot,
      currentModel: new THREE.Object3D(),
      camera,
      emit: vi.fn(),
    };

    const view = new SceneManagerXrAvatarView(sceneManager);
    view.onSessionStart({ isVR: true });
    expect(view._standoffApplied).toBe(false);

    view.applyEntryStandoff();
    expect(view._standoffApplied).toBe(true);
    expect(playerRoot.position.z).toBeLessThan(0);
  });

  it('hides avatar only in embody (first person) mode', () => {
    const playerRoot = new THREE.Group();
    const sceneManager = {
      playerRoot,
      currentModel: new THREE.Object3D(),
      camera: new THREE.PerspectiveCamera(),
      emit: vi.fn(),
    };

    const view = new SceneManagerXrAvatarView(sceneManager);
    view.setMode(XR_AVATAR_VIEW_FIRST_PERSON);
    expect(playerRoot.visible).toBe(false);

    view.setMode(XR_AVATAR_VIEW_THIRD_PERSON);
    expect(playerRoot.visible).toBe(true);
  });

  it('toggleMode switches between third and first person', () => {
    const playerRoot = new THREE.Group();
    const sceneManager = {
      playerRoot,
      currentModel: new THREE.Object3D(),
      camera: new THREE.PerspectiveCamera(),
      emit: vi.fn(),
    };

    const view = new SceneManagerXrAvatarView(sceneManager);
    expect(view.toggleMode()).toBe(XR_AVATAR_VIEW_FIRST_PERSON);
    expect(view.toggleMode()).toBe(XR_AVATAR_VIEW_THIRD_PERSON);
  });

  it('aligns locomotion rig so camera reaches avatar head on first-person', () => {
    const playerRoot = new THREE.Group();
    const model = new THREE.Object3D();
    const headBone = new THREE.Bone();
    headBone.name = 'Head';
    headBone.position.set(0, 1.7, -1.5);
    model.add(headBone);
    playerRoot.add(model);
    playerRoot.updateMatrixWorld(true);

    const rig = new THREE.Group();
    rig.add(playerRoot);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    camera.updateMatrixWorld(true);

    const sceneManager = {
      playerRoot,
      currentModel: model,
      camera,
      xrLocomotionRig: rig,
      emit: vi.fn(),
    };

    expect(getAvatarHeadWorldPosition(sceneManager, new THREE.Vector3())).toBeTruthy();

    const view = new SceneManagerXrAvatarView(sceneManager);
    view.setMode(XR_AVATAR_VIEW_FIRST_PERSON);

    const headAfter = new THREE.Vector3();
    getAvatarHeadWorldPosition(sceneManager, headAfter);
    const cam = new THREE.Vector3();
    camera.getWorldPosition(cam);
    // XZ only — embody must not shift rig Y (floor drift).
    expect(Math.hypot(headAfter.x - cam.x, headAfter.z - cam.z)).toBeLessThan(0.05);
    expect(playerRoot.visible).toBe(false);
  });

  it('leaves avatar 1m in front of the headset and switches Move to Viewpoint on disembody', () => {
    const playerRoot = new THREE.Group();
    playerRoot.position.set(0.5, 0, -2);
    playerRoot.rotation.y = 0.4;
    const model = new THREE.Object3D();
    const headBone = new THREE.Bone();
    headBone.name = 'Head';
    headBone.position.set(0, 1.7, 0);
    model.add(headBone);
    playerRoot.add(model);

    const wrapper = new THREE.Group();
    const rig = new THREE.Group();
    wrapper.add(rig);
    rig.add(playerRoot);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1.6, -1);
    camera.updateMatrixWorld(true);
    rig.updateMatrixWorld(true);

    const locomotion = new SceneManagerXrLocomotion({
      xrLocomotionRig: rig,
      camera,
      playerRoot,
      emit: vi.fn(),
    });
    locomotion.setMode(XR_LOCOMOTION_MODE_AVATAR);

    const sceneManager = {
      playerRoot,
      currentModel: model,
      camera,
      xrLocomotionRig: rig,
      emit: vi.fn(),
    };

    const view = new SceneManagerXrAvatarView(sceneManager, locomotion);
    view.setMode(XR_AVATAR_VIEW_FIRST_PERSON);

    // Simulate walking while embodied.
    rig.position.z += 1.2;
    rig.updateMatrixWorld(true);
    camera.position.z += 1.2;
    camera.updateMatrixWorld(true);

    const disembodyCam = new THREE.Vector3();
    camera.getWorldPosition(disembodyCam);

    view.setMode(XR_AVATAR_VIEW_THIRD_PERSON);

    expect(playerRoot.visible).toBe(true);
    expect(locomotion.mode).toBe(XR_LOCOMOTION_MODE_VIEWPOINT);

    const afterWorld = new THREE.Vector3();
    playerRoot.getWorldPosition(afterWorld);
    // Avatar 1 m ahead of the (fixed) headset along look dir (−Z here).
    expect(afterWorld.z).toBeCloseTo(disembodyCam.z - THIRD_PERSON_BEHIND_M, 1);
    expect(Math.abs(afterWorld.x - disembodyCam.x)).toBeLessThan(0.05);
    expect(afterWorld.y).toBeCloseTo(0);

    const dist = Math.hypot(afterWorld.x - disembodyCam.x, afterWorld.z - disembodyCam.z);
    expect(dist).toBeCloseTo(THIRD_PERSON_BEHIND_M, 1);
  });

  it('faces the headset look direction on disembody (including under a yawed rig)', () => {
    const playerRoot = new THREE.Group();
    playerRoot.position.set(0, 0, 0);
    playerRoot.rotation.y = 0.8; // stale local yaw from before embody
    const model = new THREE.Object3D();
    const headBone = new THREE.Bone();
    headBone.name = 'Head';
    headBone.position.set(0, 1.7, 0);
    model.add(headBone);
    playerRoot.add(model);

    const rig = new THREE.Group();
    rig.rotation.y = Math.PI / 2; // snap-turned while embodied
    rig.add(playerRoot);

    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    // Look toward +X in world
    camera.lookAt(1, 1.6, 0);
    camera.updateMatrixWorld(true);
    rig.updateMatrixWorld(true);

    const sceneManager = {
      playerRoot,
      currentModel: model,
      camera,
      xrLocomotionRig: rig,
      emit: vi.fn(),
    };

    const view = new SceneManagerXrAvatarView(sceneManager);
    view.mode = XR_AVATAR_VIEW_FIRST_PERSON;
    view._placeAvatarAtDisembodySpot();
    playerRoot.visible = true;
    view.mode = XR_AVATAR_VIEW_THIRD_PERSON;

    const avatarFwd = new THREE.Vector3();
    playerRoot.getWorldDirection(avatarFwd);
    avatarFwd.y = 0;
    avatarFwd.normalize();

    const headsetFwd = new THREE.Vector3();
    camera.getWorldDirection(headsetFwd);
    headsetFwd.y = 0;
    headsetFwd.normalize();

    expect(avatarFwd.dot(headsetFwd)).toBeGreaterThan(0.99);
  });

  it('does not drift floor/avatar Y across embody toggles', () => {
    const playerRoot = new THREE.Group();
    playerRoot.position.set(0, 0, -1.5);
    const model = new THREE.Object3D();
    const headBone = new THREE.Bone();
    headBone.name = 'Head';
    // Head taller than headset — old code shifted rig.y and sank the floor.
    headBone.position.set(0, 1.85, 0);
    model.add(headBone);
    playerRoot.add(model);

    const rig = new THREE.Group();
    rig.add(playerRoot);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    camera.updateMatrixWorld(true);
    rig.updateMatrixWorld(true);

    const sceneManager = {
      playerRoot,
      currentModel: model,
      camera,
      xrLocomotionRig: rig,
      emit: vi.fn(),
    };

    const startRigY = rig.position.y;
    const view = new SceneManagerXrAvatarView(sceneManager);

    view.setMode(XR_AVATAR_VIEW_FIRST_PERSON);
    expect(rig.position.y).toBeCloseTo(startRigY);

    view.setMode(XR_AVATAR_VIEW_THIRD_PERSON);
    view.setMode(XR_AVATAR_VIEW_FIRST_PERSON);
    view.setMode(XR_AVATAR_VIEW_THIRD_PERSON);

    expect(rig.position.y).toBeCloseTo(startRigY);
    const feet = new THREE.Vector3();
    playerRoot.getWorldPosition(feet);
    expect(feet.y).toBeCloseTo(0);
  });
});
