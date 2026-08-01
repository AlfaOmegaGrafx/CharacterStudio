import { describe, expect, it, vi } from 'vitest';
import * as THREE from '../library/three.js';
import {
  SceneManagerXrLocomotion,
  XR_LOCOMOTION_MODE_AVATAR,
  XR_LOCOMOTION_MODE_VIEWPOINT,
  alignXrLocomotionRigToViewport,
  applyDesktopViewFromXr,
  captureXrViewAsDesktop,
  snapTurnLocomotionRigAroundViewer,
} from '../library/sceneManagerXrLocomotion.js';

describe('SceneManagerXrLocomotion', () => {
  function makeScene({ withPlayer = false } = {}) {
    const rig = new THREE.Group();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1.6, -1);

    const playerRoot = withPlayer ? new THREE.Group() : null;
    if (playerRoot) {
      rig.add(playerRoot);
    }

    return {
      xrLocomotionRig: rig,
      camera,
      playerRoot,
      emit: vi.fn(),
    };
  }

  // Viewpoint mapping (ff58a784): +Y on stick → camera-forward
  const leftStickPlusY = [
    { handedness: 'left', axes: [0, 0, 0, 1] },
    { handedness: 'right', axes: [0, 0, 0, 0] },
  ];

  // Avatar mode inverts axes — −Y is forward for the avatar
  const leftStickAvatarForward = [
    { handedness: 'left', axes: [0, 0, 0, -1] },
    { handedness: 'right', axes: [0, 0, 0, 0] },
  ];

  const rightStickTurn = [
    { handedness: 'left', axes: [0, 0, 0, 0] },
    { handedness: 'right', axes: [0, 0, 1, 0] },
  ];

  it('defaults to viewpoint (ff58a784 left-stick rig move)', () => {
    const sceneManager = makeScene();
    const locomotion = new SceneManagerXrLocomotion(sceneManager);
    expect(locomotion.mode).toBe(XR_LOCOMOTION_MODE_VIEWPOINT);
  });

  it('moves rig forward in viewpoint mode on +Y stick (original mapping)', () => {
    const sceneManager = makeScene();
    const locomotion = new SceneManagerXrLocomotion(sceneManager);
    const startZ = sceneManager.xrLocomotionRig.position.z;

    locomotion.update(1, leftStickPlusY);

    expect(sceneManager.xrLocomotionRig.position.z).toBeLessThan(startZ);
  });

  it('moves playerRoot forward in avatar mode with inverted stick', () => {
    const sceneManager = makeScene({ withPlayer: true });
    const locomotion = new SceneManagerXrLocomotion(sceneManager);
    locomotion.setMode(XR_LOCOMOTION_MODE_AVATAR);
    const startZ = sceneManager.playerRoot.position.z;

    locomotion.update(1, leftStickAvatarForward);

    expect(sceneManager.xrLocomotionRig.position.z).toBe(0);
    expect(sceneManager.playerRoot.position.z).toBeLessThan(startZ);
  });

  it('does not use viewpoint stick sign for avatar (avatar +Y goes opposite)', () => {
    const sceneManager = makeScene({ withPlayer: true });
    const locomotion = new SceneManagerXrLocomotion(sceneManager);
    locomotion.setMode(XR_LOCOMOTION_MODE_AVATAR);
    const startZ = sceneManager.playerRoot.position.z;

    locomotion.update(1, leftStickPlusY);

    expect(sceneManager.playerRoot.position.z).toBeGreaterThan(startZ);
  });

  it('snap-turns viewpoint rig on right stick in viewpoint mode', () => {
    const sceneManager = makeScene();
    const locomotion = new SceneManagerXrLocomotion(sceneManager);
    const startRot = sceneManager.xrLocomotionRig.rotation.y;

    locomotion.update(1, rightStickTurn);

    expect(sceneManager.xrLocomotionRig.rotation.y).not.toBeCloseTo(startRot);
    expect(snapTurnLocomotionRigAroundViewer).toBeTypeOf('function');
  });

  it('yaw-turns avatar (not viewpoint) on right stick in avatar mode', () => {
    const sceneManager = makeScene({ withPlayer: true });
    const locomotion = new SceneManagerXrLocomotion(sceneManager);
    locomotion.setMode(XR_LOCOMOTION_MODE_AVATAR);
    const startRigRot = sceneManager.xrLocomotionRig.rotation.y;
    const startAvatarRot = sceneManager.playerRoot.rotation.y;

    locomotion.update(1, rightStickTurn);

    expect(sceneManager.xrLocomotionRig.rotation.y).toBeCloseTo(startRigRot);
    expect(sceneManager.playerRoot.rotation.y).not.toBeCloseTo(startAvatarRot);
  });

  it('preferAvatarMove (first-person) moves avatar only even in viewpoint mode', () => {
    const sceneManager = makeScene({ withPlayer: true });
    const locomotion = new SceneManagerXrLocomotion(sceneManager);
    expect(locomotion.mode).toBe(XR_LOCOMOTION_MODE_VIEWPOINT);
    const startRigZ = sceneManager.xrLocomotionRig.position.z;
    const startAvatarZ = sceneManager.playerRoot.position.z;

    locomotion.update(1, leftStickAvatarForward, { preferAvatarMove: true });

    expect(sceneManager.xrLocomotionRig.position.z).toBeCloseTo(startRigZ);
    expect(sceneManager.playerRoot.position.z).toBeLessThan(startAvatarZ);
  });

  it('firstPersonEmbody moves the rig (avatar rides along) even if mode is avatar', () => {
    const sceneManager = makeScene({ withPlayer: true });
    const locomotion = new SceneManagerXrLocomotion(sceneManager);
    locomotion.setMode(XR_LOCOMOTION_MODE_AVATAR);
    const startRigZ = sceneManager.xrLocomotionRig.position.z;
    const startAvatarLocalZ = sceneManager.playerRoot.position.z;

    // Viewpoint stick mapping (+Y forward) while embodied
    locomotion.update(1, leftStickPlusY, { firstPersonEmbody: true });

    expect(sceneManager.xrLocomotionRig.position.z).toBeLessThan(startRigZ);
    // Local avatar offset unchanged — it rides with the rig
    expect(sceneManager.playerRoot.position.z).toBeCloseTo(startAvatarLocalZ);
  });

  it('firstPersonEmbody snap-turns the rig, not avatar local yaw', () => {
    const sceneManager = makeScene({ withPlayer: true });
    const locomotion = new SceneManagerXrLocomotion(sceneManager);
    locomotion.setMode(XR_LOCOMOTION_MODE_AVATAR);
    const startRigRot = sceneManager.xrLocomotionRig.rotation.y;
    const startAvatarRot = sceneManager.playerRoot.rotation.y;

    locomotion.update(1, rightStickTurn, { firstPersonEmbody: true });

    expect(sceneManager.xrLocomotionRig.rotation.y).not.toBeCloseTo(startRigRot);
    expect(sceneManager.playerRoot.rotation.y).toBeCloseTo(startAvatarRot);
  });

  it('aligns locomotion rig from live headset pose to pre-XR viewport', () => {
    const wrapper = new THREE.Group();
    wrapper.position.set(0, 0.1, -0.5);
    const rig = new THREE.Group();
    wrapper.add(rig);
    const camera = new THREE.PerspectiveCamera();
    // Live headset elsewhere in the room (not origin).
    camera.position.set(1.2, 1.6, 0.4);
    camera.lookAt(1.2, 1.6, -1);

    const sceneManager = {
      vrSceneWrapper: wrapper,
      xrLocomotionRig: rig,
      camera,
      renderer: { xr: { isPresenting: true } },
      preXRCameraPosition: new THREE.Vector3(2, 1.8, 4),
      preXRCameraTarget: new THREE.Vector3(2, 1.0, 3),
      emit: vi.fn(),
    };

    const frame = {
      getViewerPose: () => ({
        transform: {
          position: { x: 1.2, y: 1.6, z: 0.4 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        },
      }),
    };

    expect(alignXrLocomotionRigToViewport(sceneManager, frame, {})).toBe(true);
    // D = H − C − wrapper  (look −Z ⇒ no yaw)
    expect(rig.position.x).toBeCloseTo(1.2 - 2 - 0);
    expect(rig.position.z).toBeCloseTo(0.4 - 4 - -0.5);
  });

  it('returns false when viewer pose is not ready yet', () => {
    const sceneManager = {
      xrLocomotionRig: new THREE.Group(),
      camera: new THREE.PerspectiveCamera(),
      preXRCameraPosition: new THREE.Vector3(2, 1.8, 4),
      renderer: { xr: { isPresenting: true } },
      emit: vi.fn(),
    };
    const frame = { getViewerPose: () => null };
    expect(alignXrLocomotionRigToViewport(sceneManager, frame, {})).toBe(false);
  });

  it('skips align when no camera pose is available', () => {
    const sceneManager = {
      xrLocomotionRig: new THREE.Group(),
      camera: new THREE.PerspectiveCamera(),
      emit: vi.fn(),
    };
    expect(alignXrLocomotionRigToViewport(sceneManager)).toBe(false);
  });

  it('maps XR headset pose into desktop OrbitControls space (undoes rig offset)', () => {
    const wrapper = new THREE.Group();
    wrapper.position.set(0, 0.2, -0.5);
    const rig = new THREE.Group();
    rig.position.set(1, 0, 2);
    wrapper.add(rig);
    const scene = new THREE.Scene();
    scene.add(wrapper);
    wrapper.updateMatrixWorld(true);

    const camera = new THREE.PerspectiveCamera();
    // Headset world position (reference space)
    camera.position.set(3, 1.6, 1);
    camera.lookAt(3, 1.6, 0);
    camera.updateMatrixWorld(true);

    const controls = { target: new THREE.Vector3(), update: vi.fn() };
    const sceneManager = {
      camera,
      controls,
      vrSceneWrapper: wrapper,
      xrLocomotionRig: rig,
      preXRCameraPosition: new THREE.Vector3(0, 1.6, 5),
      preXRCameraTarget: new THREE.Vector3(0, 1.0, 0),
      preXRCameraZoom: 1,
      renderer: { xr: { isPresenting: true } },
    };

    const view = captureXrViewAsDesktop(sceneManager);
    expect(view).toBeTruthy();
    // Desktop pos = inv(rig.world) * headsetWorld
    const expected = new THREE.Vector3(3, 1.6, 1);
    const inv = new THREE.Matrix4().copy(rig.matrixWorld).invert();
    expected.applyMatrix4(inv);
    expect(view.position.x).toBeCloseTo(expected.x, 4);
    expect(view.position.z).toBeCloseTo(expected.z, 4);

    applyDesktopViewFromXr(sceneManager, view);
    expect(camera.position.x).toBeCloseTo(view.position.x, 5);
    expect(controls.target.x).toBeCloseTo(view.target.x, 5);
    expect(controls.update).toHaveBeenCalled();
  });
});
