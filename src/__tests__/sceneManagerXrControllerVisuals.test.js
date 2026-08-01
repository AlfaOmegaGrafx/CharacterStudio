import { describe, expect, it, vi } from 'vitest';
import * as THREE from '../library/three.js';
import {
  SceneManagerXrControllerVisuals,
  XR_HAND_TRACKING_FEATURE,
  isXrInputVisualObject,
} from '../library/sceneManagerXrControllerVisuals.js';

function makeXrStub(grips, hands, controllers) {
  return {
    getControllerGrip: (i) => grips[i],
    getHand: (i) => hands[i],
    getController: (i) => controllers[i],
  };
}

function makeHandSource(handedness) {
  const joints = new Map();
  for (const name of ['wrist', 'thumb-tip', 'index-finger-tip']) {
    joints.set(name, { jointName: name });
  }
  return {
    handedness,
    hand: {
      values: () => joints.values(),
    },
    targetRaySpace: {},
  };
}

describe('sceneManagerXrControllerVisuals', () => {
  it('exports hand-tracking feature id', () => {
    expect(XR_HAND_TRACKING_FEATURE).toBe('hand-tracking');
  });

  it('detects XR input visual objects for floor-wrapper skip', () => {
    const g = new THREE.Group();
    g.name = 'XRControllerGrip0';
    expect(isXrInputVisualObject(g)).toBe(true);
    const other = new THREE.Group();
    other.name = 'WorldRoot';
    expect(isXrInputVisualObject(other)).toBe(false);
  });

  it('attaches grip and hand groups under scene (reference space), not locomotion wrapper', () => {
    const scene = new THREE.Group();
    scene.name = 'Scene';
    const locomotion = new THREE.Group();
    locomotion.name = 'XRLocomotionRig';
    locomotion.position.set(0, 1.2, -0.5);
    scene.add(locomotion);

    const grips = [new THREE.Group(), new THREE.Group()];
    const hands = [new THREE.Group(), new THREE.Group()];
    const controllers = [new THREE.Group(), new THREE.Group()];

    const sceneManager = {
      xrLocomotionRig: locomotion,
      vrSceneWrapper: locomotion,
      scene,
      renderer: { xr: makeXrStub(grips, hands, controllers) },
    };

    const visuals = new SceneManagerXrControllerVisuals(sceneManager);
    visuals.prepare(sceneManager.renderer);
    expect(visuals._prepared).toBe(true);
    expect(grips[0].children.length).toBeGreaterThan(0);

    visuals.onSessionStart({
      enabledFeatures: ['hand-tracking'],
      inputSources: [],
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    expect(visuals.isAttached).toBe(true);
    expect(grips[0].parent).toBe(scene);
    expect(grips[1].parent).toBe(scene);
    expect(hands[0].parent).toBe(scene);
    expect(hands[1].parent).toBe(scene);
    expect(grips[0].parent).not.toBe(locomotion);

    visuals.onSessionEnd();
    expect(visuals.isAttached).toBe(false);
    expect(grips[0].parent).toBeNull();
    expect(hands[0].parent).toBeNull();
    expect(visuals._prepared).toBe(true);
    expect(grips[0].children.length).toBeGreaterThan(0);
  });

  it('keeps controller grips visible at idle opacity when preferHand is true', () => {
    const scene = new THREE.Group();
    const grips = [new THREE.Group(), new THREE.Group()];
    const hands = [new THREE.Group(), new THREE.Group()];
    const controllers = [new THREE.Group(), new THREE.Group()];
    const leftSrc = makeHandSource('left');
    grips[0].userData.inputSource = { handedness: 'left', gamepad: {} };
    const gripMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 1, transparent: false });
    grips[0].add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), gripMat));
    hands[0].userData.opennexusHandSource = leftSrc;
    hands[0].userData.inputSource = leftSrc;

    const visuals = new SceneManagerXrControllerVisuals({
      scene,
      renderer: { xr: makeXrStub(grips, hands, controllers) },
    });
    visuals.prepare();
    visuals.onSessionStart({
      enabledFeatures: ['hand-tracking'],
      inputSources: [leftSrc],
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    visuals.syncVisibility(
      [
        {
          handedness: 'left',
          preferHand: true,
          inputSource: leftSrc,
        },
      ],
      [leftSrc],
    );
    expect(hands[0].visible).toBe(true);
    expect(grips[0].visible).toBe(true);
    expect(controllers[0].visible).toBe(true);
    expect(gripMat.opacity).toBeCloseTo(0.5);
  });

  it('keeps controller grips visible when pointers have no handedness match yet', () => {
    const scene = new THREE.Group();
    const grips = [new THREE.Group(), new THREE.Group()];
    const hands = [new THREE.Group(), new THREE.Group()];
    const controllers = [new THREE.Group(), new THREE.Group()];

    const visuals = new SceneManagerXrControllerVisuals({
      scene,
      renderer: { xr: makeXrStub(grips, hands, controllers) },
    });
    visuals.prepare();
    visuals.onSessionStart({
      enabledFeatures: [],
      inputSources: [],
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    visuals.syncVisibility([]);
    expect(grips[0].visible).toBe(true);
    expect(grips[1].visible).toBe(true);
    expect(hands[0].visible).toBe(false);
  });

  it('drives hand joints from getJointPose when preferHand (Galaxy dormant-controller case)', () => {
    const scene = new THREE.Group();
    const grips = [new THREE.Group(), new THREE.Group()];
    const hands = [new THREE.Group(), new THREE.Group()];
    const controllers = [new THREE.Group(), new THREE.Group()];
    const leftSrc = makeHandSource('left');

    const wristMatrix = new THREE.Matrix4().makeTranslation(0.2, 1.4, -0.3);
    const frame = {
      session: { inputSources: [leftSrc] },
      getJointPose: (joint) => {
        if (joint.jointName !== 'wrist') return null;
        return {
          transform: { matrix: wristMatrix.toArray() },
          radius: 0.01,
        };
      },
    };
    const refSpace = {};

    const visuals = new SceneManagerXrControllerVisuals({
      scene,
      renderer: { xr: makeXrStub(grips, hands, controllers) },
    });
    visuals.prepare();
    visuals.onSessionStart({
      enabledFeatures: ['hand-tracking'],
      inputSources: [leftSrc],
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    // Simulate: Three.js never assigned hand to a slot; we still drive joints.
    visuals.update(frame, refSpace, [
      { handedness: 'left', preferHand: true, inputSource: leftSrc },
    ]);

    const hand = visuals._handsByHandedness.get('left');
    expect(hand).toBeTruthy();
    expect(hand.visible).toBe(true);
    expect(hand.joints.wrist.visible).toBe(true);
    expect(hand.joints.wrist.position.y).toBeCloseTo(1.4, 5);
    expect(grips[0].visible).toBe(true);
  });
});
