/**
 * In-headset menu (left controller Y) — bridges 2D viewport features into WebXR.
 * Tabs: Scene (view / move / measure) and Animation (BottomDisplayMenu essentials).
 */
import * as THREE from './three.js';
import {
  XR_AVATAR_VIEW_FIRST_PERSON,
  XR_AVATAR_VIEW_THIRD_PERSON,
} from './sceneManagerXrAvatarView.js';

/** Landscape panel (wider than tall) so rows fit without hanging off. */
const PANEL_W = 0.58;
const PANEL_H = 0.44;
const ROW_H = 0.038;
const ROW_GAP = 0.005;
const PAD_Y = 0.016;
const TAB_H = 0.036;
const MENU_BUTTON_Y = 5;
const TOGGLE_VIEW_BUTTON_X = 4;
const TOGGLE_LOCO_BUTTON = 3;
/**
 * Panel sits on the left grip. PlaneGeometry faces +Z; yaw stays 0 so the face
 * is readable. Pitch tips the panel toward the headset at resting hand pose (~45°).
 * Offset keeps the panel low on the controller (not floating 0.5 m ahead).
 */
const PANEL_YAW = 0;
const PANEL_PITCH_UP = -Math.PI / 4;
/** Local grip offsets (m): forward (−Z) and down (−Y) onto the controller. */
const PANEL_GRIP_FORWARD_M = 0.1;
const PANEL_GRIP_DOWN_M = 0.08;

export const XR_MENU_TAB_SCENE = 'scene';
export const XR_MENU_TAB_ANIMATION = 'animation';

const _raycaster = new THREE.Raycaster();
const _rayDir = new THREE.Vector3();
const _hitNormal = new THREE.Vector3();
/** Prefer a row over the panel background when hits are within this epsilon (m). */
const ROW_OVER_BG_EPS = 0.02;

/**
 * Opaque canvas label (avoids XR alpha flicker / dither).
 * @param {string} text
 * @param {{ width?: number, height?: number, fontPx?: number, active?: boolean }} [opts]
 */
function createTextTexture(text, opts = {}) {
  const width = opts.width ?? 1024;
  const height = opts.height ?? 128;
  const fontPx = opts.fontPx ?? 42;
  const active = !!opts.active;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = active ? '#1e3a5f' : '#141a28';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = active ? '#6aa8ff' : '#3a4660';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);
  ctx.fillStyle = '#e8ecf4';
  ctx.font = `bold ${fontPx}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxWidth = width - 48;
  let draw = text;
  if (ctx.measureText(draw).width > maxWidth) {
    while (draw.length > 3 && ctx.measureText(`${draw}…`).width > maxWidth) {
      draw = draw.slice(0, -1);
    }
    draw = `${draw}…`;
  }
  ctx.fillText(draw, width / 2, height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * One solid row = hit target + visible label (same mesh).
 * @param {THREE.Group} parent
 * @param {number} w
 * @param {number} h
 * @param {number} y
 * @param {string} action
 * @param {THREE.Texture|null} tex
 * @param {number} z
 * @param {number} [x]
 */
function addMenuRow(parent, w, h, y, action, tex, z = 0.002, x = 0) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex || null,
    color: tex ? 0xffffff : 0x2a3548,
    transparent: false,
    depthTest: true,
    depthWrite: true,
    side: THREE.FrontSide,
  });
  const row = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  row.position.set(x, y, z);
  row.userData.xrMenuAction = action;
  row.renderOrder = 1001;
  parent.add(row);
  return row;
}

/**
 * @param {number} rowCount
 * @param {number} index from top (0)
 * @param {number} [topY]
 */
function rowY(rowCount, index, topY = null) {
  const top =
    topY != null ? topY : PANEL_H / 2 - PAD_Y - ROW_H / 2;
  const bottom = -PANEL_H / 2 + PAD_Y + ROW_H / 2;
  const usable = top - bottom;
  if (rowCount <= 1) return top;
  const stackH = rowCount * ROW_H + (rowCount - 1) * ROW_GAP;
  if (stackH <= usable) {
    return top - index * (ROW_H + ROW_GAP);
  }
  const step = usable / (rowCount - 1);
  return top - index * step;
}

/**
 * Resolve animationManager from SceneManager (wired by SceneContext).
 * @param {import('./sceneManager.js').SceneManager|null|undefined} sceneManager
 */
export function resolveXrAnimationManager(sceneManager) {
  if (!sceneManager) return null;
  if (typeof sceneManager.getAnimationManager === 'function') {
    return sceneManager.getAnimationManager() || null;
  }
  return sceneManager.animationManager || null;
}

export class SceneManagerXrMenu {
  /**
   * @param {import('./sceneManager.js').SceneManager} sceneManager
   * @param {import('./sceneManagerXrAvatarView.js').SceneManagerXrAvatarView} avatarView
   * @param {import('./sceneManagerXrLocomotion.js').SceneManagerXrLocomotion} locomotion
   * @param {import('./sceneManagerXrMeasure.js').SceneManagerXrMeasure} [measure]
   */
  constructor(sceneManager, avatarView, locomotion, measure = null) {
    this.sceneManager = sceneManager;
    this.avatarView = avatarView;
    this.locomotion = locomotion;
    this.measure = measure;
    this.open = false;
    /** @type {'scene'|'animation'} */
    this.tab = XR_MENU_TAB_SCENE;
    this._group = null;
    this._panelContent = null;
    this._statusLabel = null;
    this._locomotionLabel = null;
    this._measureLabel = null;
    this._animStatusLabel = null;
    this._prevLeftY = false;
    this._prevLeftX = false;
    this._prevLeftStick = false;
    this._hitTargets = [];
    /** @type {THREE.Object3D|null} */
    this._hovered = null;
  }

  reset() {
    this._destroyPanel();
    this.open = false;
    this.tab = XR_MENU_TAB_SCENE;
    this._prevLeftY = false;
    this._prevLeftX = false;
    this._prevLeftStick = false;
    this._hovered = null;
  }

  /**
   * Ray hit against the open menu (for cursor stop + select).
   * @param {import('./sceneManagerXrInput.js').XrPointerState} pointer
   * @returns {{ point: THREE.Vector3, distance: number, action?: string, object?: THREE.Object3D }|null}
   */
  raycast(pointer) {
    if (!this.open || !this._hitTargets.length || !this._group) return null;
    this._group.updateMatrixWorld(true);
    _rayDir.copy(pointer.rayDirection).normalize();
    _raycaster.set(pointer.rayOrigin, _rayDir);
    _raycaster.far = 4;
    if ('firstHitOnly' in _raycaster) {
      _raycaster.firstHitOnly = false;
    }
    const hits = _raycaster.intersectObjects(this._hitTargets, false);
    const hit = this._pickBestMenuHit(hits);
    if (!hit) return null;
    return {
      point: hit.point.clone(),
      distance: hit.distance,
      action: hit.object?.userData?.xrMenuAction,
      object: hit.object,
    };
  }

  /**
   * @param {THREE.Intersection[]} hits
   * @returns {THREE.Intersection|null}
   */
  _pickBestMenuHit(hits) {
    if (!hits?.length) return null;
    const frontFacing = hits.filter((hit) => {
      if (!hit.face) return true;
      _hitNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      return _hitNormal.dot(_rayDir) < 0;
    });
    const candidates = frontFacing.length ? frontFacing : hits;
    const nearest = candidates[0];
    const nearestDist = nearest.distance;
    let best = nearest;
    for (const hit of candidates) {
      if (hit.distance - nearestDist > ROW_OVER_BG_EPS) break;
      const action = hit.object?.userData?.xrMenuAction;
      const isBg =
        hit.object?.name === 'XRMenuBackground' ||
        hit.object === this._panelContent?.children?.[0];
      const bestIsBg =
        best.object?.name === 'XRMenuBackground' ||
        best.object === this._panelContent?.children?.[0];
      if (action && action !== 'close' && bestIsBg) {
        best = hit;
        continue;
      }
      if (action === 'close' && !isBg && bestIsBg) {
        best = hit;
      }
    }
    return best;
  }

  /**
   * Ray-select menu rows (controller or hand). Returns true if a menu action fired.
   * @param {import('./sceneManagerXrInput.js').XrPointerState[]} pointers
   */
  handlePointerSelect(pointers) {
    if (!this.open || !this._hitTargets.length || !this._group) return false;

    for (const pointer of pointers) {
      if (!pointer.selectStart) continue;
      const hit = this.raycast(pointer);
      if (!hit?.action) continue;
      if (this._runMenuAction(hit.action)) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {import('./sceneManagerXrInput.js').XrPointerState[]} pointers
   */
  update(pointers) {
    const left = pointers.find((p) => p.handedness === 'left');

    if (left?.connected && left.inputSource?.gamepad) {
      const buttons = left.inputSource.gamepad.buttons || [];
      const yPressed = !!(buttons[MENU_BUTTON_Y]?.pressed || buttons[MENU_BUTTON_Y]?.value > 0.5);
      const xPressed = !!(
        buttons[TOGGLE_VIEW_BUTTON_X]?.pressed || buttons[TOGGLE_VIEW_BUTTON_X]?.value > 0.5
      );
      const stickPressed = !!(
        buttons[TOGGLE_LOCO_BUTTON]?.pressed || buttons[TOGGLE_LOCO_BUTTON]?.value > 0.5
      );

      if (yPressed && !this._prevLeftY) {
        this.open = !this.open;
        if (this.open) {
          this.tab = XR_MENU_TAB_SCENE;
          this._createPanel();
        } else {
          this._destroyPanel();
        }
      }

      // Left X toggles view whether or not the menu is open.
      if (xPressed && !this._prevLeftX) {
        this._runMenuAction('toggle-view');
      }

      // Left stick click toggles Move whether or not the menu is open.
      if (stickPressed && !this._prevLeftStick) {
        this._runMenuAction('toggle-locomotion');
      }

      this._prevLeftY = yPressed;
      this._prevLeftX = xPressed;
      this._prevLeftStick = stickPressed;
    }

    if (this.open) {
      this._updatePanelPose(left);
      this._updateHover(pointers);
    }
  }

  /**
   * Hover highlight — visual only.
   * @param {import('./sceneManagerXrInput.js').XrPointerState[]} pointers
   */
  _updateHover(pointers) {
    let next = null;
    for (const pointer of pointers) {
      if (!pointer?.connected) continue;
      const hit = this.raycast(pointer);
      if (hit?.object?.userData?.xrMenuAction) {
        next = hit.object;
        break;
      }
    }
    if (this._hovered === next) return;
    if (this._hovered?.isMesh && this._hovered.material?.color) {
      this._hovered.material.color.setHex(0xffffff);
    }
    this._hovered = next;
    if (next?.isMesh && next.material?.color && next.userData.xrMenuAction !== 'close') {
      next.material.color.setHex(0xa8c4ff);
    }
  }

  _getAnimationManager() {
    return resolveXrAnimationManager(this.sceneManager);
  }

  /**
   * @param {string} action
   */
  _runMenuAction(action) {
    if (action === 'close') {
      this.open = false;
      this._destroyPanel();
      return true;
    }
    if (action === 'tab-scene') {
      return this._switchTab(XR_MENU_TAB_SCENE);
    }
    if (action === 'tab-animation') {
      return this._switchTab(XR_MENU_TAB_ANIMATION);
    }
    if (action === 'toggle-view') {
      this.avatarView.toggleMode();
      this._refreshStatusLabels();
      return true;
    }
    if (action === 'toggle-locomotion') {
      this.locomotion.toggleMode();
      this._refreshStatusLabels();
      return true;
    }
    if (action === 'toggle-measure' && this.measure) {
      this.measure.toggleActive();
      this._refreshStatusLabels();
      return true;
    }
    if (action === 'cycle-measure-unit' && this.measure) {
      this.measure.cycleUnit();
      this._refreshStatusLabels();
      return true;
    }
    if (action === 'anim-play-pause') {
      this._toggleAnimPlayPause();
      this._refreshStatusLabels();
      return true;
    }
    if (action === 'anim-prev') {
      void this._animPrev();
      return true;
    }
    if (action === 'anim-next') {
      void this._animNext();
      return true;
    }
    return false;
  }

  _switchTab(tab) {
    if (tab !== XR_MENU_TAB_SCENE && tab !== XR_MENU_TAB_ANIMATION) return false;
    if (this.tab === tab && this._group) return true;
    this.tab = tab;
    if (!this.open) return true;

    const pos = this._group?.position.clone() || null;
    const quat = this._group?.quaternion.clone() || null;
    this._createPanel();
    if (this._group && pos && quat) {
      this._group.position.copy(pos);
      this._group.quaternion.copy(quat);
      this._group.updateMatrixWorld(true);
    }
    return true;
  }

  _toggleAnimPlayPause() {
    const am = this._getAnimationManager();
    if (!am) return;
    if (am.isPaused?.()) {
      am.setTime?.(0);
      am.play?.();
      am.setSpeed?.(1);
    } else {
      am.pause?.();
      am.setSpeed?.(0);
    }
  }

  async _animNext() {
    const am = this._getAnimationManager();
    if (!am?.loadNextAnimation) return;
    try {
      await am.loadNextAnimation();
      am.triggerPrimarySync?.();
      if (!/t-?pose/i.test(am.getCurrentAnimationName?.() || '')) {
        am.play?.();
        am.setSpeed?.(1);
      }
      this._refreshStatusLabels();
    } catch (err) {
      console.warn('[XR][menu] anim-next failed:', err?.message || err);
    }
  }

  async _animPrev() {
    const am = this._getAnimationManager();
    if (!am?.loadPreviousAnimation) return;
    try {
      await am.loadPreviousAnimation();
      am.triggerPrimarySync?.();
      if (!/t-?pose/i.test(am.getCurrentAnimationName?.() || '')) {
        am.play?.();
        am.setSpeed?.(1);
      }
      this._refreshStatusLabels();
    } catch (err) {
      console.warn('[XR][menu] anim-prev failed:', err?.message || err);
    }
  }

  _createPanel() {
    this._destroyPanel();
    const scene = this.sceneManager?.scene;
    if (!scene) return;

    const group = new THREE.Group();
    group.name = 'XRFeatureMenu';

    const panelContent = new THREE.Group();
    panelContent.name = 'XRMenuPanelContent';
    panelContent.rotation.y = PANEL_YAW;
    panelContent.rotation.x = PANEL_PITCH_UP;
    group.add(panelContent);
    this._panelContent = panelContent;

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(PANEL_W, PANEL_H),
      new THREE.MeshBasicMaterial({
        color: 0x0a0e18,
        transparent: false,
        opacity: 1,
        depthTest: true,
        depthWrite: true,
        side: THREE.DoubleSide,
      }),
    );
    bg.name = 'XRMenuBackground';
    bg.position.z = 0;
    bg.renderOrder = 1000;
    bg.userData.xrMenuAction = 'close';
    panelContent.add(bg);

    // Extra opaque back plate so the scene never shows through in XR.
    const backPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(PANEL_W, PANEL_H),
      new THREE.MeshBasicMaterial({
        color: 0x05070c,
        transparent: false,
        opacity: 1,
        depthTest: true,
        depthWrite: true,
        side: THREE.DoubleSide,
      }),
    );
    backPlate.name = 'XRMenuBackPlate';
    backPlate.position.z = -0.004;
    backPlate.renderOrder = 999;
    panelContent.add(backPlate);

    // Tabs — Scene | Animation
    const tabY = PANEL_H / 2 - PAD_Y - TAB_H / 2;
    const tabW = PANEL_W * 0.44;
    const tabGap = PANEL_W * 0.02;
    addMenuRow(
      panelContent,
      tabW,
      TAB_H,
      tabY,
      'tab-scene',
      createTextTexture('Scene', {
        fontPx: 36,
        active: this.tab === XR_MENU_TAB_SCENE,
      }),
      0.003,
      -(tabW / 2 + tabGap / 2),
    );
    addMenuRow(
      panelContent,
      tabW,
      TAB_H,
      tabY,
      'tab-animation',
      createTextTexture('Animation', {
        fontPx: 36,
        active: this.tab === XR_MENU_TAB_ANIMATION,
      }),
      0.003,
      tabW / 2 + tabGap / 2,
    );

    const contentTop = tabY - TAB_H / 2 - ROW_GAP - ROW_H / 2;

    if (this.tab === XR_MENU_TAB_ANIMATION) {
      this._buildAnimationRows(panelContent, contentTop);
    } else {
      this._buildSceneRows(panelContent, contentTop);
    }

    this._hitTargets = [];
    panelContent.traverse((child) => {
      if (child.isMesh) {
        this._hitTargets.push(child);
      }
    });

    scene.add(group);
    this._group = group;
    console.info(
      '[XR][menu] Opened — tab:',
      this.tab,
      '| left-grip attached, point + trigger or Y closes',
    );
  }

  /**
   * @param {THREE.Group} panelContent
   * @param {number} contentTop
   */
  _buildSceneRows(panelContent, contentTop) {
    // Pair each control with its live status directly underneath.
    /** @type {{ action: string, text: string, status?: 'view'|'loco'|'measure' }[]} */
    const rows = [
      { action: 'close', text: 'Close · Y / point+trigger' },
      { action: 'toggle-view', text: 'View · X or point toggles' },
      { action: 'toggle-view', text: this._viewModeLabel(), status: 'view' },
      { action: 'toggle-locomotion', text: 'Move · stick click or point' },
      { action: 'toggle-locomotion', text: this.locomotion.modeLabel(), status: 'loco' },
      { action: 'toggle-measure', text: 'Measure · point start then end' },
    ];
    if (this.measure) {
      rows.push({
        action: 'toggle-measure',
        text: this.measure.statusLabel(),
        status: 'measure',
      });
    }

    rows.forEach((row, i) => {
      const mesh = addMenuRow(
        panelContent,
        PANEL_W * 0.92,
        ROW_H,
        rowY(rows.length, i, contentTop),
        row.action,
        createTextTexture(row.text, { fontPx: 36 }),
      );
      if (row.status === 'view') {
        mesh.name = 'XRMenuViewStatus';
        this._statusLabel = mesh;
      } else if (row.status === 'loco') {
        mesh.name = 'XRMenuLocomotionStatus';
        this._locomotionLabel = mesh;
      } else if (row.status === 'measure') {
        mesh.name = 'XRMenuMeasureStatus';
        this._measureLabel = mesh;
      }
    });
  }

  /**
   * @param {THREE.Group} panelContent
   * @param {number} contentTop
   */
  _buildAnimationRows(panelContent, contentTop) {
    const am = this._getAnimationManager();
    const rows = [
      { action: 'close', text: 'Close · Y / point+trigger' },
      { action: 'anim-play-pause', text: this._animPlayPauseLabel(am) },
      { action: 'anim-prev', text: 'Previous clip' },
      { action: 'anim-next', text: 'Next clip' },
    ];
    const totalRows = rows.length + 1;

    rows.forEach((row, i) => {
      addMenuRow(
        panelContent,
        PANEL_W * 0.92,
        ROW_H,
        rowY(totalRows, i, contentTop),
        row.action,
        createTextTexture(row.text, { fontPx: 36 }),
      );
    });

    const clipTex = createTextTexture(this._animClipLabel(am), { fontPx: 34 });
    if (clipTex) {
      const clip = addMenuRow(
        panelContent,
        PANEL_W * 0.92,
        ROW_H,
        rowY(totalRows, rows.length, contentTop),
        'anim-play-pause',
        clipTex,
      );
      clip.name = 'XRMenuAnimStatus';
      this._animStatusLabel = clip;
    }
  }

  _destroyPanel() {
    if (!this._group) return;
    this._group.parent?.remove(this._group);
    this._group.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose?.();
        if (child.material?.map) child.material.map.dispose();
        child.material?.dispose?.();
      }
    });
    this._group = null;
    this._panelContent = null;
    this._statusLabel = null;
    this._locomotionLabel = null;
    this._measureLabel = null;
    this._animStatusLabel = null;
    this._hitTargets = [];
    this._hovered = null;
  }

  /**
   * Follow left controller/hand grip while the menu is open.
   * @param {import('./sceneManagerXrInput.js').XrPointerState|undefined} left
   */
  _updatePanelPose(left) {
    if (!this._group || !left?.gripPosition) return;
    this._group.position.copy(left.gripPosition);
    if (left.gripQuaternion) {
      this._group.quaternion.copy(left.gripQuaternion);
    }
    // Sit on the controller: slightly forward and down in grip-local space.
    this._group.translateZ(-PANEL_GRIP_FORWARD_M);
    this._group.translateY(-PANEL_GRIP_DOWN_M);
    this._group.updateMatrixWorld(true);
  }

  _viewModeLabel() {
    return this.avatarView.mode === XR_AVATAR_VIEW_FIRST_PERSON
      ? 'View: Embody (1st person)'
      : 'View: Third person';
  }

  _animPlayPauseLabel(am) {
    if (!am) return 'Play/Pause · (no animation manager)';
    return am.isPaused?.() ? 'Play · point+trigger' : 'Pause · point+trigger';
  }

  _animClipLabel(am) {
    if (!am) return 'Clip: —';
    const name = am.getCurrentAnimationName?.() || '—';
    const paused = am.isPaused?.() ? 'paused' : 'playing';
    return `Clip: ${name} (${paused})`;
  }

  _refreshStatusLabels() {
    if (this._statusLabel) {
      const tex = createTextTexture(this._viewModeLabel(), { fontPx: 36 });
      if (tex) {
        this._statusLabel.material.map?.dispose();
        this._statusLabel.material.map = tex;
        this._statusLabel.material.needsUpdate = true;
      }
    }
    if (this._locomotionLabel) {
      const tex = createTextTexture(this.locomotion.modeLabel(), { fontPx: 36 });
      if (tex) {
        this._locomotionLabel.material.map?.dispose();
        this._locomotionLabel.material.map = tex;
        this._locomotionLabel.material.needsUpdate = true;
      }
    }
    if (this._measureLabel && this.measure) {
      const tex = createTextTexture(this.measure.statusLabel(), { fontPx: 36 });
      if (tex) {
        this._measureLabel.material.map?.dispose();
        this._measureLabel.material.map = tex;
        this._measureLabel.material.needsUpdate = true;
      }
    }
    if (this._animStatusLabel) {
      const am = this._getAnimationManager();
      const tex = createTextTexture(this._animClipLabel(am), { fontPx: 34 });
      if (tex) {
        this._animStatusLabel.material.map?.dispose();
        this._animStatusLabel.material.map = tex;
        this._animStatusLabel.material.needsUpdate = true;
      }
    }
    console.info(
      '[XR][menu] tab:',
      this.tab,
      '| View:',
      this.avatarView.mode,
      '| Locomotion:',
      this.locomotion.mode,
      '| Measure:',
      this.measure?.active ? this.measure.statusLabel() : 'off',
      '| Anim:',
      this._animClipLabel(this._getAnimationManager()),
    );
  }
}

// Re-export layout constants for tests
export const XR_MENU_PANEL_YAW = PANEL_YAW;
export const XR_MENU_PANEL_PITCH = PANEL_PITCH_UP;
export const XR_MENU_GRIP_FORWARD_M = PANEL_GRIP_FORWARD_M;
export const XR_MENU_GRIP_DOWN_M = PANEL_GRIP_DOWN_M;
