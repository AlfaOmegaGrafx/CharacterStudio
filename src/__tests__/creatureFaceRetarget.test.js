/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  shouldUseCreatureFaceRetarget,
  collectNamedBones,
  resolveCreatureFaceBones,
  describeCreatureFaceCapability,
  applyExpressionWeightRecordToCreature,
  resetCreatureFaceRetarget,
} from '../library/creatureFaceRetarget.js';

function makeBoneTree(names) {
  const root = new THREE.Group();
  root.name = 'creatureRoot';
  const bones = {};
  for (const name of names) {
    const b = new THREE.Bone();
    b.name = name;
    bones[name] = b;
    root.add(b);
  }
  return { root, bones };
}

describe('creatureFaceRetarget', () => {
  let infoSpy;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('shouldUseCreatureFaceRetarget detects SkinTokens and creature_template', () => {
    const skin = new THREE.Group();
    skin.userData.skintokensRig = true;
    expect(shouldUseCreatureFaceRetarget(skin)).toBe(true);

    const creature = new THREE.Group();
    creature.userData.autoRigMeta = {
      rig_info: { rig_mode: 'creature_template', generation_method: 'mesh2motion_creature_template' },
    };
    expect(shouldUseCreatureFaceRetarget(creature)).toBe(true);

    const vrmish = new THREE.Group();
    vrmish.userData.vrm = {};
    expect(shouldUseCreatureFaceRetarget(vrmish)).toBe(false);
  });

  it('resolves Chin as jaw and Ear is not treated as eye', () => {
    const { root } = makeBoneTree(['Head', 'Chin', 'Ear_L', 'Ear_R']);
    const byName = collectNamedBones(root);
    const resolved = resolveCreatureFaceBones(byName);
    expect(resolved.jaw?.name).toBe('Chin');
    expect(resolved.eyeL).toBeNull();
    expect(resolved.eyeR).toBeNull();
  });

  it('drives Chin on jaw_drop (fox-like creature)', () => {
    const { root, bones } = makeBoneTree(['Head', 'Chin']);
    const rest = bones.Chin.quaternion.clone();
    const result = applyExpressionWeightRecordToCreature(root, { jaw_drop: 1 }, { lerpFactor: 1 });
    expect(result.applied).toBe(true);
    expect(result.capability.canDriveJaw).toBe(true);
    expect(bones.Chin.quaternion.equals(rest)).toBe(false);

    resetCreatureFaceRetarget(root);
    expect(bones.Chin.quaternion.equals(rest)).toBe(true);
  });

  it('Eagle Knight–style SkinTokens (bone_N only) no-ops with clear log', () => {
    const { root } = makeBoneTree([
      'bone_0',
      'bone_1',
      'bone_2',
      'bone_3',
      'bone_4',
      'bone_5',
    ]);
    root.userData.skintokensRig = true;
    root.userData.autoRigMeta = {
      rig_info: { generation_method: 'skintokens_tokenrig_cli' },
    };

    expect(shouldUseCreatureFaceRetarget(root)).toBe(true);
    const cap = describeCreatureFaceCapability(root);
    expect(cap.canDriveJaw).toBe(false);
    expect(cap.canDriveEyes).toBe(false);

    const result = applyExpressionWeightRecordToCreature(
      root,
      { jaw_drop: 0.9, eyes_closed_left: 1, eyes_closed_right: 1 },
      { lerpFactor: 1 },
    );
    expect(result.applied).toBe(false);
    expect(infoSpy).toHaveBeenCalled();
    const noopCall = infoSpy.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('no jaw/chin/eye bones'),
    );
    expect(noopCall).toBeTruthy();
  });

  it('drives eye bones on eyes_closed_*', () => {
    const { root, bones } = makeBoneTree(['Head', 'Eye_L', 'Eye_R']);
    const restL = bones.Eye_L.quaternion.clone();
    const result = applyExpressionWeightRecordToCreature(
      root,
      { eyes_closed_left: 1, eyes_closed_right: 0.5 },
      { lerpFactor: 1 },
    );
    expect(result.applied).toBe(true);
    expect(bones.Eye_L.quaternion.equals(restL)).toBe(false);
  });

  it('ignores smile / brow channels (no full FACS on creatures)', () => {
    const { root, bones } = makeBoneTree(['Head', 'Chin']);
    const rest = bones.Chin.quaternion.clone();
    const result = applyExpressionWeightRecordToCreature(
      root,
      {
        mouth_smile_left: 1,
        mouth_smile_right: 1,
        brow_down_left: 1,
        brow_down_right: 1,
      },
      { lerpFactor: 1 },
    );
    expect(result.applied).toBe(false);
    expect(bones.Chin.quaternion.equals(rest)).toBe(true);
  });

  it('fromAigc mesh without morphs uses creature retarget', () => {
    const { root } = makeBoneTree(['Jaw', 'bone_0']);
    root.userData.fromAigc = true;
    expect(shouldUseCreatureFaceRetarget(root)).toBe(true);
  });
});
