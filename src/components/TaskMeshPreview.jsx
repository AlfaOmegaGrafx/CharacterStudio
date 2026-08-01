import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { get3daigcAuthHeaders } from '../library/taskManager.js';
import { resolveTaskModelUrl } from '../library/taskModelUrl.js';

/**
 * Sidebar preview for completed mesh / auto-rig jobs.
 * Auto-loads a compact orbit GLB viewer when the mesh URL is available
 * (completion / DGX sync) — does not wait for the main viewport.
 */
export default function TaskMeshPreview({
  meshUrl,
  apiEndpoint,
  /** When true (default), start 3D as soon as the row is on-screen. */
  autoLoad3d = true,
}) {
  const hostRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [meshStatus, setMeshStatus] = useState('idle');
  const [meshError, setMeshError] = useState(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin: '80px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const shouldLoad = Boolean(autoLoad3d && meshUrl && inView);

  return (
    <div ref={hostRef} className="task-mesh-preview" onClick={(e) => e.stopPropagation()}>
      {!meshUrl ? (
        <div className="task-mesh-preview-hint">Preview unavailable</div>
      ) : !shouldLoad ? (
        <div className="task-mesh-preview-hint">Waiting for preview…</div>
      ) : (
        <>
          <TaskMeshOrbitCanvas
            meshUrl={meshUrl}
            apiEndpoint={apiEndpoint}
            onStatus={setMeshStatus}
            onError={setMeshError}
          />
          {meshStatus === 'loading' ? (
            <div className="task-mesh-preview-hint">Loading 3D…</div>
          ) : null}
          {meshError ? (
            <div className="task-mesh-preview-hint task-mesh-preview-hint--error">{meshError}</div>
          ) : null}
        </>
      )}
    </div>
  );
}

function frameObject(camera, controls, object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return false;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const fov = (camera.fov * Math.PI) / 180;
  const distance = Math.max((maxDim / (2 * Math.tan(fov / 2))) * 1.45, maxDim * 0.9);
  const dir = new THREE.Vector3(1.05, 0.65, 1.15).normalize();
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(distance / 200, 0.001);
  camera.far = Math.max(distance * 40, maxDim * 40, 50);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
  return true;
}

function brightenMaterials(root) {
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      if ('envMapIntensity' in mat) mat.envMapIntensity = Math.max(mat.envMapIntensity || 0, 1);
      if ('metalness' in mat && typeof mat.metalness === 'number') {
        mat.metalness = Math.min(mat.metalness, 0.35);
      }
      if ('roughness' in mat && typeof mat.roughness === 'number') {
        mat.roughness = Math.max(mat.roughness, 0.45);
      }
      mat.needsUpdate = true;
    }
  });
}

function TaskMeshOrbitCanvas({ meshUrl, apiEndpoint, onStatus, onError }) {
  const mountRef = useRef(null);
  const onStatusRef = useRef(onStatus);
  const onErrorRef = useRef(onError);
  onStatusRef.current = onStatus;
  onErrorRef.current = onError;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !meshUrl) return undefined;

    let cancelled = false;
    let animationId = 0;
    let renderer = null;
    let controls = null;
    let root = null;
    let resizeObserver = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a2e);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 5000);
    camera.position.set(1.6, 1.2, 1.6);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setClearColor(0x2a2a2e, 1);
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    if ('toneMapping' in renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    }
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(2.5, 4, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xaabbff, 0.55);
    fill.position.set(-2, 1, -1);
    scene.add(fill);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);

    const setSize = () => {
      const width = Math.max(mount.clientWidth || 0, 160);
      const height = Math.max(mount.clientHeight || 0, 160);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    };
    setSize();
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => setSize());
      resizeObserver.observe(mount);
    }

    const animate = () => {
      if (cancelled) return;
      controls.update();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    onStatusRef.current?.('loading');
    onErrorRef.current?.(null);

    const abs = resolveTaskModelUrl(meshUrl, apiEndpoint);
    fetch(abs, { headers: get3daigcAuthHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const type = response.headers.get('content-type') || '';
        if (type.includes('text/html')) {
          throw new Error('Mesh URL returned HTML (check API proxy)');
        }
        return response.arrayBuffer();
      })
      .then(
        (buffer) =>
          new Promise((resolve, reject) => {
            if (!buffer || buffer.byteLength < 16) {
              reject(new Error('Empty mesh download'));
              return;
            }
            const loader = new GLTFLoader();
            loader.parse(buffer, '', resolve, reject);
          }),
      )
      .then((gltf) => {
        if (cancelled) return;
        root = gltf.scene;
        root.name = 'task-mesh-preview';
        brightenMaterials(root);
        scene.add(root);
        setSize();
        if (!frameObject(camera, controls, root)) {
          throw new Error('Mesh has no visible geometry');
        }
        onStatusRef.current?.('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        onStatusRef.current?.('error');
        onErrorRef.current?.(err?.message || 'Failed to load mesh preview');
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationId);
      resizeObserver?.disconnect();
      controls?.dispose();
      if (root) {
        scene.remove(root);
        root.traverse((obj) => {
          obj.geometry?.dispose?.();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
          else mat?.dispose?.();
        });
      }
      renderer?.dispose();
      if (renderer?.domElement?.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [meshUrl, apiEndpoint]);

  return <div ref={mountRef} className="task-mesh-preview-canvas" />;
}
