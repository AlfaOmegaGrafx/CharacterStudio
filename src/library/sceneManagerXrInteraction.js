/**
 * SceneManager XR interaction orchestrator — Phases 3–5 (input, grab, locomotion).
 * Single subsystem owned by SceneManager; no second IWSDK World on `/`.
 * @see docs/IWSDK_OPTION_A_MIGRATION_BLUEPRINT.md
 */
import * as THREE from './three.js';
import { SceneManagerXrInput } from './sceneManagerXrInput.js';
import { SceneManagerXrGrab } from './sceneManagerXrGrab.js';
import {
  SceneManagerXrLocomotion,
  ensureXrLocomotionRig,
  alignXrLocomotionRigToViewport,
} from './sceneManagerXrLocomotion.js';
import { SceneManagerXrTeleport } from './sceneManagerXrTeleport.js';
import { SceneManagerXrMouseEmulation } from './sceneManagerXrMouseEmulation.js';
import {
  SceneManagerXrAvatarView,
  XR_AVATAR_VIEW_FIRST_PERSON,
} from './sceneManagerXrAvatarView.js';
import { SceneManagerXrMenu } from './sceneManagerXrMenu.js';
import { SceneManagerXrMeasure } from './sceneManagerXrMeasure.js';
import {
  createSceneManagerXrControllerVisuals,
} from './sceneManagerXrControllerVisuals.js';
import {
  isThumbstickTeleportAim,
  readRightThumbstickAxes,
} from './sceneManagerXrAxes.js';
import { WORLD_LAYER_EVENTS } from './worldLayerArchitecture.js';

/**
 * @param {import('./sceneManager.js').SceneManager} sceneManager
 */
export function createSceneManagerXrInteraction(sceneManager) {
  return new SceneManagerXrInteraction(sceneManager);
}

export class SceneManagerXrInteraction {
  /**
   * @param {import('./sceneManager.js').SceneManager} sceneManager
   */
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.input = new SceneManagerXrInput();
    this.grab = new SceneManagerXrGrab(sceneManager);
    this.locomotion = new SceneManagerXrLocomotion(sceneManager);
    this.teleport = new SceneManagerXrTeleport(sceneManager);
    this.avatarView = new SceneManagerXrAvatarView(sceneManager, this.locomotion);
    this.measure = new SceneManagerXrMeasure(sceneManager);
    this.menu = new SceneManagerXrMenu(
      sceneManager,
      this.avatarView,
      this.locomotion,
      this.measure,
    );
    this.mouseEmulation = new SceneManagerXrMouseEmulation(sceneManager);
    this.controllerVisuals = createSceneManagerXrControllerVisuals(sceneManager);
    this._demoCube = null;
    this._lastFrameTime = 0;
    this._capabilityLogged = false;
    /** Align viewer to desktop viewport on the first XR frame with a real headset pose. */
    this._viewportAlignPending = false;
  }

  /**
   * @param {XRSession} session
   * @param {{ isVR?: boolean, isAR?: boolean }} [options]
   */
  onSessionStart(session, options = {}) {
    ensureXrLocomotionRig(this.sceneManager);
    // Defer viewport align until the first XR frame (headset pose is not at origin).
    this._viewportAlignPending = true;
    this.controllerVisuals.onSessionStart(session);
    this.avatarView.onSessionStart(options);
    this.syncGrabbablesFromScene();
    if (this.grab._grabbableRoots.length === 0 && options.isVR !== false) {
      this._ensureDemoGrabbable();
    }
    this._logCapabilityOnce(session, options);
    console.log(
      '[XR][interaction] Session started — input, grab, locomotion, teleport, controller/hand visuals on /',
      this.avatarView.hasAvatar()
        ? `(avatar: ${this.avatarView.mode}, left Y = menu, left X = toggle view)`
        : '',
    );
  }

  onSessionEnd() {
    this._viewportAlignPending = false;
    this.menu.reset();
    this.measure.reset();
    this.avatarView.onSessionEnd();
    this.controllerVisuals.onSessionEnd();
    this._removeDemoGrabbable();
    this.grab.reset();
    this.input.reset();
    this.mouseEmulation.reset();
    this.locomotion.reset();
    this.teleport.reset();
    this._capabilityLogged = false;
    this._lastFrameTime = 0;
    console.log('[XR][interaction] Session ended — interaction state cleared');
  }

  syncGrabbablesFromScene() {
    const count = this.grab.syncGrabbablesFromScene();
    if (count > 0) {
      console.log('[XR][interaction] Grabbable props registered:', count);
    }
    return count;
  }

  /**
   * @param {number} time
   * @param {XRFrame|null} frame
   */
  update(time, frame) {
    if (!frame || !this.sceneManager.renderer?.xr?.isPresenting) return;

    const referenceSpace =
      this.sceneManager.xrRenderReferenceSpace ||
      this.sceneManager.xrReferenceSpace ||
      this.sceneManager.renderer.xr.getReferenceSpace?.();

    if (this._viewportAlignPending) {
      const aligned = alignXrLocomotionRigToViewport(
        this.sceneManager,
        frame,
        referenceSpace,
      );
      if (aligned) {
        this._viewportAlignPending = false;
        // Standoff after viewport align so the avatar sits in front of the live headset.
        this.avatarView.applyEntryStandoff();
      }
    }

    const session =
      frame.session ||
      this.sceneManager.xrSession ||
      this.sceneManager.renderer.xr.getSession?.();

    let inputSources = [];
    try {
      inputSources = session?.inputSources ? Array.from(session.inputSources) : [];
    } catch {
      inputSources = [];
    }

    const deltaSeconds = this._lastFrameTime
      ? Math.min(0.05, (time - this._lastFrameTime) / 1000)
      : 0.016;
    this._lastFrameTime = time;

    const pointers = this.input.update(frame, referenceSpace, inputSources);
    this.controllerVisuals.update(frame, referenceSpace, pointers);
    this.sceneManager.emit?.('xrInputFrame', { pointers, frame, time });

    const right = pointers.find((p) => p.handedness === 'right') || null;
    const rightStick = readRightThumbstickAxes(right);

    this.menu.update(pointers);

    const menuOpen = this.menu.open;
    const menuConsumedSelect = menuOpen && this.menu.handlePointerSelect(pointers);
    const measureConsumedSelect =
      !menuConsumedSelect &&
      this.measure.active &&
      !menuOpen &&
      this.measure.handlePointerSelect(pointers);

    // Always draw rays; when menu is open, stop cursor on the panel face.
    // Stick locomotion stays live while the menu is open.
    this.grab.update(pointers, {
      uiRaycast: menuOpen ? (p) => this.menu.raycast(p) : null,
      suppressGrab: menuConsumedSelect || measureConsumedSelect,
    });

    if (!measureConsumedSelect) {
      if (!menuConsumedSelect) {
        this.mouseEmulation.update(pointers);
      }

      const hasGrab = this.grab.hasActiveGrab();
      if (hasGrab) {
        this.teleport.reset();
        this.grab.applyRightStickPlacement(rightStick.y, deltaSeconds, pointers);
      } else {
        this.teleport.update(right);
      }

      const skipRightTurn =
        this.teleport.isAiming() ||
        isThumbstickTeleportAim(rightStick.y, rightStick.x);
      this.locomotion.update(deltaSeconds, pointers, {
        skipRightTurn,
        // First-person: drive the locomotion rig so the embodied avatar (and world)
        // slide under the headset. Moving playerRoot alone leaves the camera fixed.
        firstPersonEmbody: this.avatarView.mode === XR_AVATAR_VIEW_FIRST_PERSON,
      });
    }
  }

  _ensureDemoGrabbable() {
    if (this._demoCube || !this.sceneManager.propsRoot) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.25, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x4488ff }),
    );
    mesh.name = 'XRDemoGrabbable';
    mesh.position.set(0.6, 1.1, -0.8);
    mesh.userData.xrGrabbable = true;
    mesh.userData.interaction = { type: 'grabbable' };
    this.sceneManager.propsRoot.add(mesh);
    this._demoCube = mesh;
    this.syncGrabbablesFromScene();
    console.log('[XR][interaction] Demo grabbable cube added (no world props loaded)');
  }

  _removeDemoGrabbable() {
    if (!this._demoCube) return;
    this._demoCube.parent?.remove(this._demoCube);
    this._demoCube.geometry?.dispose?.();
    this._demoCube.material?.dispose?.();
    this._demoCube = null;
  }

  /**
   * @param {XRSession} session
   * @param {{ isVR?: boolean, isAR?: boolean }} options
   */
  _logCapabilityOnce(session, options) {
    if (this._capabilityLogged) return;
    this._capabilityLogged = true;
    let features = [];
    try {
      if (session?.enabledFeatures) features = [...session.enabledFeatures];
    } catch {
      features = [];
    }
    console.info('[XR][interaction] Capability baseline', {
      mode: session?.mode,
      environmentBlendMode: session?.environmentBlendMode,
      referenceSpace:
        this.sceneManager.xrRenderReferenceSpace?.constructor?.name || 'unknown',
      enabledFeatures: features,
      isVR: options.isVR,
      isAR: options.isAR,
      grabbables: this.grab._grabbableRoots.length,
      hasLocomotionRig: !!this.sceneManager.xrLocomotionRig,
      worldLayerEvents: WORLD_LAYER_EVENTS,
    });
  }
}
