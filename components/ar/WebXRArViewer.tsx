'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
// Note: importing from three/examples is supported in modern bundlers.
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

type Graph2dLinearEq = { a: number; b: number; c: number };

type ArRecipe = {
  version: 1;
  template:
    | 'balance_scale'
    | 'number_line'
    | 'graph_2d'
    | 'fraction_blocks'
    | 'algebra_tiles'
    | 'generic_overlay';
  title: string;
  shortGoal: string;
  steps: string[];
  overlay?: Record<string, unknown>;
};

function isGraph2dLinearSystemOverlay(overlay: unknown): overlay is {
  kind: 'graph_2d_linear_system';
  eq1: Graph2dLinearEq;
  eq2?: Graph2dLinearEq;
  xRange?: [number, number];
  yRange?: [number, number];
  showIntersection?: boolean;
  showGrid?: boolean;
} {
  if (!overlay || typeof overlay !== 'object') return false;
  const o = overlay as any;
  return (
    o.kind === 'graph_2d_linear_system' &&
    o.eq1 &&
    typeof o.eq1.a === 'number' &&
    typeof o.eq1.b === 'number' &&
    typeof o.eq1.c === 'number'
  );
}

function solve2x2(eq1: Graph2dLinearEq, eq2: Graph2dLinearEq): { x: number; y: number } | null {
  // a1*x + b1*y = c1
  // a2*x + b2*y = c2
  const det = eq1.a * eq2.b - eq2.a * eq1.b;
  if (Math.abs(det) < 1e-9) return null;
  const x = (eq1.c * eq2.b - eq2.c * eq1.b) / det;
  const y = (eq1.a * eq2.c - eq2.a * eq1.c) / det;
  return { x, y };
}

function lineEndpoints(eq: Graph2dLinearEq, xMin: number, xMax: number, yMin: number, yMax: number):
  | { p1: THREE.Vector3; p2: THREE.Vector3 }
  | null {
  // We draw the 2D line on an XZ plane: x -> X, y -> Z.
  // Handle vertical lines: b == 0 => a*x = c => x = c/a
  if (Math.abs(eq.b) < 1e-9) {
    if (Math.abs(eq.a) < 1e-9) return null;
    const x = eq.c / eq.a;
    if (x < xMin || x > xMax) return null;
    return {
      p1: new THREE.Vector3(x, 0, yMin),
      p2: new THREE.Vector3(x, 0, yMax),
    };
  }

  const y1 = (eq.c - eq.a * xMin) / eq.b;
  const y2 = (eq.c - eq.a * xMax) / eq.b;

  // Clamp if way outside range (basic guard)
  const c1 = Math.max(yMin, Math.min(yMax, y1));
  const c2 = Math.max(yMin, Math.min(yMax, y2));

  return {
    p1: new THREE.Vector3(xMin, 0, c1),
    p2: new THREE.Vector3(xMax, 0, c2),
  };
}

function createGraphGroup(overlay: any): THREE.Group {
  const group = new THREE.Group();

  const xRange: [number, number] = Array.isArray(overlay?.xRange) && overlay.xRange.length === 2 ? overlay.xRange : [-6, 6];
  const yRange: [number, number] = Array.isArray(overlay?.yRange) && overlay.yRange.length === 2 ? overlay.yRange : [-4, 4];
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;

  // Base plane
  const planeGeo = new THREE.PlaneGeometry(xMax - xMin, yMax - yMin);
  const planeMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.9, metalness: 0.1, transparent: true, opacity: 0.6 });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  // PlaneGeometry is XY; rotate to XZ and center on ranges.
  plane.rotation.x = -Math.PI / 2;
  plane.position.set((xMin + xMax) / 2, 0, (yMin + yMax) / 2);
  group.add(plane);

  // Grid
  const showGrid = overlay?.showGrid !== false;
  if (showGrid) {
    const size = Math.max(xMax - xMin, yMax - yMin);
    const divisions = Math.min(24, Math.max(8, Math.round(size * 2)));
    const grid = new THREE.GridHelper(size, divisions, 0x4b5563, 0x243041);
    // GridHelper is centered at origin; move/scale to match plane center.
    grid.position.set((xMin + xMax) / 2, 0.001, (yMin + yMax) / 2);
    group.add(grid);
  }

  // Axes (X and Z)
  const axisMat = new THREE.LineBasicMaterial({ color: 0xe5e7eb, transparent: true, opacity: 0.85 });
  const xAxisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(xMin, 0.01, 0),
    new THREE.Vector3(xMax, 0.01, 0),
  ]);
  const zAxisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.01, yMin),
    new THREE.Vector3(0, 0.01, yMax),
  ]);
  const xAxis = new THREE.Line(xAxisGeo, axisMat);
  const zAxis = new THREE.Line(zAxisGeo, axisMat);
  // Center axes on plane center.
  xAxis.position.z = (yMin + yMax) / 2;
  zAxis.position.x = (xMin + xMax) / 2;
  group.add(xAxis);
  group.add(zAxis);

  // Lines
  const eq1: Graph2dLinearEq = overlay.eq1;
  const eq2: Graph2dLinearEq | undefined = overlay.eq2;

  const e1 = lineEndpoints(eq1, xMin, xMax, yMin, yMax);
  if (e1) {
    const g = new THREE.BufferGeometry().setFromPoints([e1.p1, e1.p2]);
    const m = new THREE.LineBasicMaterial({ color: 0xff6b6b });
    group.add(new THREE.Line(g, m));
  }

  if (eq2) {
    const e2 = lineEndpoints(eq2, xMin, xMax, yMin, yMax);
    if (e2) {
      const g = new THREE.BufferGeometry().setFromPoints([e2.p1, e2.p2]);
      const m = new THREE.LineBasicMaterial({ color: 0x4fc3f7 });
      group.add(new THREE.Line(g, m));
    }
  }

  // Intersection marker
  const showIntersection = overlay?.showIntersection !== false;
  if (showIntersection && eq2) {
    const inter = solve2x2(eq1, eq2);
    if (inter) {
      const sphereGeo = new THREE.SphereGeometry(0.12, 18, 18);
      const sphereMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x111111 });
      const s = new THREE.Mesh(sphereGeo, sphereMat);
      s.position.set(inter.x, 0.06, inter.y);
      group.add(s);
    }
  }

  // Slight overall scale to "table-top" size (units are meters in WebXR)
  group.scale.setScalar(0.09);
  return group;
}

function createFallbackObject(): THREE.Group {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5, metalness: 0.1 })
  );
  base.position.y = 0.09;
  group.add(base);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.02, 16, 40),
    new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.6, metalness: 0.2 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.01;
  group.add(ring);

  return group;
}

export default function WebXRArViewer({ recipe }: { recipe: ArRecipe | null }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const buttonHostRef = useRef<HTMLDivElement | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string>('');
  const [diagnostic, setDiagnostic] = useState<string>('');

  const objectFactory = useMemo(() => {
    const overlay = recipe?.overlay;
    if (recipe?.template === 'graph_2d' && isGraph2dLinearSystemOverlay(overlay)) {
      return () => createGraphGroup(overlay);
    }

    return () => createFallbackObject();
  }, [recipe]);

  useEffect(() => {
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let hitTestSource: XRHitTestSource | null = null;
    let hitTestSourceRequested = false;
    let refSpace: XRReferenceSpace | null = null;
    let reticle: THREE.Mesh | null = null;
    let placedObject: THREE.Object3D | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const host = hostRef.current;
    const buttonHost = buttonHostRef.current;
    if (!host || !buttonHost) return;

    const run = async () => {
      try {
        const secure = typeof window !== 'undefined' ? window.isSecureContext : true;
        const hasXr = typeof navigator !== 'undefined' && Boolean((navigator as any).xr);
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        setDiagnostic(`secureContext=${secure ? 'true' : 'false'} | navigator.xr=${hasXr ? 'yes' : 'no'} | UA=${ua}`);

        if (typeof window !== 'undefined' && window.isSecureContext === false) {
          setSupported(false);
          setStatus(
            'WebXR AR butuh origin HTTPS/localhost. Kamu sedang akses via HTTP (IP LAN). Opsi cepat: (1) pakai USB + `adb reverse tcp:3000 tcp:3000` lalu buka `http://localhost:3000` di HP, atau (2) pakai HTTPS tunnel (Cloudflare/ngrok) / sertifikat lokal.'
          );
          return;
        }

        const xr = (navigator as any).xr as XRSystem | undefined;
        if (!xr) {
          setSupported(false);
          setStatus('WebXR tidak tersedia di browser ini.');
          return;
        }

        const ok = await xr.isSessionSupported('immersive-ar');
        setSupported(ok);
        if (!ok) {
          setStatus('Device/browser ini belum mendukung WebXR AR (immersive-ar).');
          return;
        }

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        // IMPORTANT: In immersive-ar, the camera feed is composited behind the WebGL layer.
        // If we clear with alpha=1, it looks like VR (black background) and hides the camera.
        renderer.setClearColor(0x000000, 0);
        // Initial mount can be 0x0 in aspect-ratio layouts; we also attach a ResizeObserver below.
        renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
        renderer.xr.enabled = true;
        host.innerHTML = '';
        host.appendChild(renderer.domElement);

        // Scene
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(
          70,
          Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight),
          0.01,
          30
        );

        // Light
        const hemi = new THREE.HemisphereLight(0xffffff, 0x111827, 0.9);
        scene.add(hemi);
        const dir = new THREE.DirectionalLight(0xffffff, 0.7);
        dir.position.set(2, 3, 1);
        scene.add(dir);

        // Reticle
        const ringGeo = new THREE.RingGeometry(0.09, 0.12, 32).rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
        reticle = new THREE.Mesh(ringGeo, ringMat);
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);

        // AR Button
        const btn = ARButton.createButton(renderer, {
          requiredFeatures: ['hit-test'],
          optionalFeatures: ['dom-overlay'],
          domOverlay: { root: document.body },
        });

        // ARButton uses absolute positioning by default; when inserted into a small host div
        // it can end up invisible. Force it to be a normal inline button.
        btn.style.position = 'relative';
        btn.style.bottom = 'auto';
        btn.style.left = 'auto';
        btn.style.right = 'auto';
        btn.style.top = 'auto';
        btn.style.margin = '0';
        btn.style.padding = '8px 10px';
        btn.style.borderRadius = '10px';
        btn.style.border = '1px solid rgba(255,255,255,0.25)';
        btn.style.background = 'rgba(0,0,0,0.55)';
        btn.style.color = '#fff';
        btn.style.fontSize = '12px';
        btn.style.lineHeight = '14px';

        buttonHost.innerHTML = '';
        buttonHost.appendChild(btn);

        setStatus('Klik tombol “Start AR”, arahkan kamera ke permukaan datar, tunggu reticle muncul, lalu tap untuk menaruh objek.');

        const onSelect = () => {
          if (!scene || !reticle) return;
          if (!reticle.visible) {
            setStatus('Belum menemukan permukaan datar. Gerakkan kamera pelan-pelan sampai reticle (lingkaran) muncul, lalu tap.');
            return;
          }

          if (placedObject) {
            scene.remove(placedObject);
            placedObject = null;
          }

          const obj = objectFactory();
          obj.position.setFromMatrixPosition(reticle.matrix);
          obj.quaternion.setFromRotationMatrix(reticle.matrix);
          scene.add(obj);
          placedObject = obj;
        };

        renderer.xr.addEventListener('sessionstart', () => {
          const session = renderer?.xr.getSession();
          if (!session) return;
          session.addEventListener('select', onSelect);
          hitTestSourceRequested = false;
          hitTestSource = null;
          setStatus('AR aktif. Arahkan kamera ke permukaan datar, tunggu reticle muncul, lalu tap untuk menaruh objek.');
        });

        renderer.xr.addEventListener('sessionend', () => {
          hitTestSourceRequested = false;
          hitTestSource = null;
          refSpace = null;
          if (reticle) reticle.visible = false;
          setStatus('AR berhenti.');
        });

        const applySize = () => {
          if (!renderer || !camera || !host) return;
          const w = Math.max(1, host.clientWidth);
          const h = Math.max(1, host.clientHeight);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => applySize());
          resizeObserver.observe(host);
        }
        window.addEventListener('resize', applySize);
        applySize();

        renderer.setAnimationLoop((_time: number, frame?: XRFrame) => {
          if (!renderer || !scene || !camera) return;
          const session = renderer.xr.getSession();
          if (session && frame) {
            if (!hitTestSourceRequested) {
              const requestHitTestSource = (session as any).requestHitTestSource as
                | ((options: { space: XRReferenceSpace }) => Promise<XRHitTestSource | undefined>)
                | undefined;

              if (requestHitTestSource) {
                session
                  .requestReferenceSpace('viewer')
                  .then((space: XRReferenceSpace) => requestHitTestSource({ space }))
                  .then((source?: XRHitTestSource) => {
                    if (source) hitTestSource = source;
                  })
                  .catch(() => {
                    // ignore
                  });
              }

              session
                .requestReferenceSpace('local')
                .then((space: XRReferenceSpace) => {
                  refSpace = space;
                })
                .catch(() => {
                  // ignore
                });

              hitTestSourceRequested = true;
            }

            if (hitTestSource && refSpace && reticle) {
              const hits = frame.getHitTestResults(hitTestSource);
              if (hits.length) {
                const pose = hits[0].getPose(refSpace);
                if (pose) {
                  reticle.visible = true;
                  reticle.matrix.fromArray(pose.transform.matrix);
                }
              } else {
                reticle.visible = false;
              }
            }
          }

          renderer.render(scene, camera);
        });

        return () => {
          window.removeEventListener('resize', applySize);
          try {
            resizeObserver?.disconnect();
          } catch {
            // ignore
          }
        };
      } catch (e) {
        setSupported(false);
        setStatus(e instanceof Error ? e.message : 'Gagal inisialisasi WebXR AR');
      }
    };

    let cleanupResize: (() => void) | undefined;
    void run().then((c) => {
      cleanupResize = typeof c === 'function' ? c : undefined;
    });

    return () => {
      cleanupResize?.();
      try {
        if (renderer) {
          const session = renderer.xr.getSession();
          if (session) void session.end();
        }
      } catch {
        // ignore
      }
      try {
        hitTestSource?.cancel();
      } catch {
        // ignore
      }
      try {
        renderer?.setAnimationLoop(null);
        renderer?.dispose();
      } catch {
        // ignore
      }
      if (host) host.innerHTML = '';
      if (buttonHost) buttonHost.innerHTML = '';
    };
  }, [objectFactory]);

  return (
    <div className="w-full h-full relative bg-black">
      <div ref={hostRef} className="absolute inset-0" />

      {supported === false ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-5">
          <div className="max-w-[520px] rounded-lg border border-white/15 bg-black/70 p-4 text-white">
            <div className="text-sm font-semibold">WebXR belum siap</div>
            <div className="mt-1 text-xs text-white/85">{status || 'Tidak bisa memulai WebXR AR.'}</div>
            {diagnostic ? <div className="mt-2 text-[10px] text-white/60">{diagnostic}</div> : null}
          </div>
        </div>
      ) : null}

      <div className="absolute left-3 top-3 z-10 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
        <span className="font-semibold">3D AR (WebXR)</span>
        <span className="text-white/80"> · {recipe?.template || '—'}</span>
      </div>

      <div className="absolute right-3 top-3 z-10" ref={buttonHostRef} />

      <div className="absolute inset-x-0 bottom-0 z-10 p-3 bg-black/60 text-white">
        <div className="text-xs text-white/90">
          {supported === false
            ? 'WebXR AR biasanya jalan di Android Chrome (HTTPS/localhost). Di Windows webcam, yang tersedia hanya overlay 2D.'
            : status}
        </div>
        {diagnostic ? <div className="mt-1 text-[10px] text-white/60">{diagnostic}</div> : null}
      </div>
    </div>
  );
}
