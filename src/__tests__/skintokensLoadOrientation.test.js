import { describe, it, expect } from 'vitest';
import * as THREE from '../library/three.js';
import {
  ensureSkinTokensRootFacesCamera,
  needsSkinnedMeshRigRepair,
} from '../library/rigBoneUtils.js';

describe('SkinTokens load orientation', () => {
  it('repairs SkinTokens when mesh sits behind the skeleton in Z', () => {
    const root = new THREE.Object3D();
    root.userData.skintokensRig = true;

    const skinned = new THREE.SkinnedMesh(
      new THREE.BoxGeometry(1, 2, 0.8),
      new THREE.MeshBasicMaterial(),
    );
    // Mesh shifted forward relative to bones (Dragon Knight: bones ~0.25 m behind).
    skinned.position.set(0, 0, 0.3);
    const bone = new THREE.Bone();
    bone.name = 'bone_0';
    bone.position.set(0, 0, 0);
    skinned.add(bone);
    skinned.bind(new THREE.Skeleton([bone]));
    root.add(skinned);
    root.updateMatrixWorld(true);

    expect(needsSkinnedMeshRigRepair(root)).toBe(true);
  });

  it('ignores naming-only contract fail when mesh and bones already align', () => {
    const root = new THREE.Object3D();
    root.userData.skintokensRig = true;
    root.userData.aigcRigContract = { status: 'fail', failures: ['missing_hips_bone'] };

    const hips = new THREE.Bone();
    hips.name = 'bone_0';
    hips.position.set(0, 0, 0);
    const head = new THREE.Bone();
    head.name = 'bone_5';
    head.position.set(0, 1, 0);
    hips.add(head);

    // BoxGeometry is centered at origin; translate so feet≈y0 without node transform.
    const geo = new THREE.BoxGeometry(1, 2, 1);
    geo.translate(0, 1, 0);
    const skinned = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
    skinned.add(hips);
    skinned.bind(new THREE.Skeleton([hips, head]));
    root.add(skinned);
    root.updateMatrixWorld(true);

    expect(needsSkinnedMeshRigRepair(root)).toBe(false);
  });

  it('rotates SkinTokens root when rig forward points away from camera', () => {
    const root = new THREE.Object3D();
    root.userData.skintokensRig = true;

    const hips = new THREE.Bone();
    hips.name = 'bone_0';
    hips.position.set(0, 0, 0);

    const spine = new THREE.Bone();
    spine.name = 'bone_3';
    spine.position.set(0, 1, 0);
    hips.add(spine);

    const left = new THREE.Bone();
    left.name = 'bone_25';
    left.position.set(-0.5, 0.8, 0.5);
    hips.add(left);

    const right = new THREE.Bone();
    right.name = 'bone_6';
    right.position.set(0.5, 0.8, 0.5);
    hips.add(right);

    root.add(hips);
    root.updateMatrixWorld(true);

    const rotated = ensureSkinTokensRootFacesCamera(root);
    expect(rotated).toBe(true);
    expect(Math.abs(root.rotation.y)).toBeCloseTo(Math.PI, 4);
  });
});
