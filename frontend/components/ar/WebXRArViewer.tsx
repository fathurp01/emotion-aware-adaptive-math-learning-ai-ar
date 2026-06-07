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



function createBalanceScaleGroup(overlay: any): THREE.Group {
  const group = new THREE.Group();

  // Base
  const baseGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.05;
  group.add(base);

  // Default pillar
  const pillarGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 16);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
  const pillar = new THREE.Mesh(pillarGeo, pillarMat);
  pillar.position.y = 1.0;
  group.add(pillar);

  // Beam (horizontal)
  const beamGeo = new THREE.BoxGeometry(3, 0.1, 0.2);
  const beamMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.4 });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 2.0;
  group.add(beam);

  // Pans
  const panGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.05, 32);
  const panMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3 });
  
  // Left Pan
  const leftPan = new THREE.Mesh(panGeo, panMat);
  leftPan.position.set(-1.4, 0.5, 0);
  group.add(leftPan);
  
  // Weights on Left (heuristic from string length if not numeric)
  const leftStr = String(overlay?.left || '');
  const leftCount = Math.min(5, leftStr.length > 0 ? (parseInt(leftStr) || Math.ceil(leftStr.length / 2)) : 1);
  for (let i = 0; i < leftCount; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xff4444 }));
    w.position.set(-1.6 + (i * 0.15), 0.6 + (i * 0.2), (i % 2) * 0.1);
    group.add(w);
  }

  // Left Rope
  const leftRopeGeo = new THREE.CylinderGeometry(0.01, 0.01, 1.5);
  const ropeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const leftRope = new THREE.Mesh(leftRopeGeo, ropeMat);
  leftRope.position.set(-1.4, 1.25, 0);
  group.add(leftRope);

  // Right Pan
  const rightPan = new THREE.Mesh(panGeo, panMat);
  rightPan.position.set(1.4, 0.5, 0);
  group.add(rightPan);

  // Weights on Right
  const rightStr = String(overlay?.right || '');
  const rightCount = Math.min(5, rightStr.length > 0 ? (parseInt(rightStr) || Math.ceil(rightStr.length / 2)) : 1);
  for (let i = 0; i < rightCount; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x4488ff }));
    w.position.set(1.2 + (i * 0.15), 0.6 + (i * 0.2), (i % 2) * 0.1);
    group.add(w);
  }

  // Right Rope
  const rightRope = new THREE.Mesh(leftRopeGeo, ropeMat);
  rightRope.position.set(1.4, 1.25, 0);
  group.add(rightRope);

  // Scale down for AR
  group.scale.setScalar(0.08); 
  return group;
}

function createNumberLineGroup(overlay: any): THREE.Group {
  const group = new THREE.Group();
  
  // Data extraction
  const rawStart = overlay?.start;
  const startVal = typeof rawStart === 'number' ? rawStart : 0;
  const jumps = Array.isArray(overlay?.jumps) ? overlay.jumps : [];
  const minVal = typeof overlay?.min === 'number' ? overlay.min : startVal - 5;
  const maxVal = typeof overlay?.max === 'number' ? overlay.max : startVal + 5;
  const range = maxVal - minVal || 10;
  const stepSize = 4 / Math.max(1, range); // map logic range to physical width (~4 meters scaled)

  // Main line
  const lineGeo = new THREE.CylinderGeometry(0.02, 0.02, 4.2, 12);
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.rotation.z = Math.PI / 2;
  line.position.y = 0.2;
  group.add(line);

  // Ticks
  const tickGeo = new THREE.BoxGeometry(0.02, 0.1, 0.02);
  const tickMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  
  // Create logical ticks 
  const startTick = Math.ceil(minVal);
  const endTick = Math.floor(maxVal);

  for (let i = startTick; i <= endTick; i++) {
    const offset = (i - ((minVal + maxVal) / 2)) * stepSize;
    const tick = new THREE.Mesh(tickGeo, tickMat);
    tick.position.set(offset, 0.2, 0);
    group.add(tick);
    
    // Highlight origin or start/jumps targets
    if (i === 0 || i === startVal) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.05),
        new THREE.MeshStandardMaterial({ color: i === 0 ? 0xffee00 : 0x00aaff })
      );
      marker.position.set(offset, 0.35, 0);
      group.add(marker);
    }
  }

  // Jumper arc for jumps
  let currentPos = startVal;
  jumps.forEach((impulse: number, idx: number) => {
    if (typeof impulse !== 'number') return;
    const nextPos = currentPos + impulse;
    
    // Physical X coords
    const x1 = (currentPos - ((minVal + maxVal) / 2)) * stepSize;
    const x2 = (nextPos - ((minVal + maxVal) / 2)) * stepSize;
    const dist = Math.abs(x2 - x1);
    const midX = (x1 + x2) / 2;
    const height = Math.min(1, dist * 0.5);

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x1, 0.2, 0),
      new THREE.Vector3(midX, 0.2 + height + 0.2, 0),
      new THREE.Vector3(x2, 0.2, 0)
    );
    const points = curve.getPoints(20);
    const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
    const arcMat = new THREE.LineBasicMaterial({ color: idx === 0 ? 0xff4444 : 0x44ff44, linewidth: 2 });
    const arc = new THREE.Line(arcGeo, arcMat);
    group.add(arc);
    
    currentPos = nextPos;
  });

  group.scale.setScalar(0.1);
  return group;
}

function createAlgebraTilesGroup(overlay: any): THREE.Group {
  const group = new THREE.Group();
  
  const tilesData = overlay?.tiles || {};
  const countX2 = Math.max(0, Math.min(5, tilesData.x2 ?? 1));
  const countX = Math.max(0, Math.min(5, tilesData.x ?? 2));
  const count1 = Math.max(0, Math.min(8, tilesData.constant ?? 3));

  let xOffset = -1.0;

  // x^2 tiles (Blue Square)
  const x2Geo = new THREE.BoxGeometry(1, 0.1, 1);
  const x2Mat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 }); // Blue
  for(let i=0; i<countX2; i++) {
    const t = new THREE.Mesh(x2Geo, x2Mat);
    t.position.set(xOffset, 0.05, 0);
    group.add(t);
    xOffset += 1.1;
  }

  // x tiles (Green Rectangle)
  const xGeo = new THREE.BoxGeometry(1, 0.1, 0.4);
  const xMat = new THREE.MeshStandardMaterial({ color: 0x22c55e }); // Green
  for(let i=0; i<countX; i++) {
    const t = new THREE.Mesh(xGeo, xMat);
    t.position.set(xOffset, 0.05, 0);
    group.add(t);
    xOffset += 1.1;
  }

  // 1 tiles (Yellow Small Square)
  // Stack them in grid/column if many
  const oneGeo = new THREE.BoxGeometry(0.4, 0.1, 0.4);
  const oneMat = new THREE.MeshStandardMaterial({ color: 0xeab308 }); // Yellow
  for(let i=0; i<count1; i++) {
    const t = new THREE.Mesh(oneGeo, oneMat);
    t.position.set(xOffset + (i%2)*0.5, 0.05, Math.floor(i/2)*0.5);
    group.add(t);
  }

  group.scale.setScalar(0.12);
  return group;
}

function createFractionBlocksGroup(overlay: any): THREE.Group {
  const group = new THREE.Group();

  // Frame
  const frameGeo = new THREE.BoxGeometry(3.5, 0.1, 2);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.y = 0.05;
  group.add(frame);

  // 1 Whole block reference
  const wholeGeo = new THREE.BoxGeometry(3, 0.15, 0.5);
  const wholeMat = new THREE.MeshStandardMaterial({ color: 0xff4444 }); // Red
  const whole = new THREE.Mesh(wholeGeo, wholeMat);
  whole.position.set(0, 0.15, -0.6);
  group.add(whole);

  // Parse fractions from overlay
  // e.g. ["1/2", "3/4"]
  const fracs = (Array.isArray(overlay?.fractions) ? overlay.fractions : ['1/2']) as string[];
  
  fracs.slice(0, 2).forEach((fStr, idx) => {
    const [num, den] = fStr.split('/').map(Number);
    if (!den) return;
    
    // Total width 3.0 represents "1"
    const widthPerUnit = 3.0 / den;
    const zPos = 0.2 + (idx * 0.7);
    
    // Draw denominators (outline or background)
    // Actually just draw 'num' blocks colored, and maybe 'den-num' items ghosted?
    // Let's just draw 'num' blocks for now.
    
    const blockGeo = new THREE.BoxGeometry(widthPerUnit * 0.9, 0.15, 0.5);
    const blockMat = new THREE.MeshStandardMaterial({ color: 0x4488ff }); // Blue
    
    let currentX = -1.5 + (widthPerUnit / 2); // Start left
    for(let k=0; k<num; k++) {
      const b = new THREE.Mesh(blockGeo, blockMat);
      b.position.set(currentX, 0.15, zPos);
      group.add(b);
      currentX += widthPerUnit;
    }
  });

  group.scale.setScalar(0.08);
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
    const template = recipe?.template;
    const overlay = recipe?.overlay;

    if (template === 'graph_2d' && isGraph2dLinearSystemOverlay(overlay)) {
      return () => createGraphGroup(overlay);
    }
    if (template === 'balance_scale') {
      return () => createBalanceScaleGroup(overlay);
    }
    if (template === 'number_line') {
      return () => createNumberLineGroup(overlay);
    }
    if (template === 'fraction_blocks') {
      return () => createFractionBlocksGroup(overlay);
    }
    if (template === 'algebra_tiles') {
      return () => createAlgebraTilesGroup(overlay);
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
    let activeSession: XRSession | null = null;
    let lastTrackingMessageAt = 0;

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
            'WebXR AR requires HTTPS origin or localhost. You are accessing via HTTP (LAN IP). Quick fix: (1) use USB + `adb reverse tcp:3000 tcp:3000` then open `http://localhost:3000` on phone, or (2) use HTTPS tunnel (Cloudflare/ngrok) / local certificate.',
          );
          return;
        }

        const xr = (navigator as any).xr as XRSystem | undefined;
        if (!xr) {
          setSupported(false);
          setStatus('WebXR is not available in this browser.');
          return;
        }

        const ok = await xr.isSessionSupported('immersive-ar');
        setSupported(ok);
        if (!ok) {
          setStatus('This device/browser does not support WebXR AR (immersive-ar).');
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
        // Prefer a floor-aligned reference space when available.
        // This tends to be more stable for phone AR tracking.
        renderer.xr.setReferenceSpaceType('local-floor');
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

        const mountArButton = () => {
          if (!renderer) return;

          // IMPORTANT: Do NOT use document.body as dom-overlay root.
          // If you do, the whole page becomes an overlay inside AR fullscreen (looks like "VR" / just shows the page).
          // Use a small dedicated overlay root (our button host) so the camera feed stays visible.
          const btn = ARButton.createButton(renderer, {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: buttonHost },
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
        };

        mountArButton();

        setStatus('Click "Start AR", point camera at a flat surface, wait for reticle, then tap to place object.');

        const onSelect = () => {
          if (!scene || !reticle) return;

          // If hit-test hasn't found a plane yet, still place something in front of the camera
          // so users can confirm rendering works (helps diagnose "object not visible").
          const placeOnReticle = reticle.visible;

          if (placedObject) {
            scene.remove(placedObject);
            placedObject = null;
          }

          const obj = objectFactory();

          if (placeOnReticle) {
            obj.position.setFromMatrixPosition(reticle.matrix);
            obj.quaternion.setFromRotationMatrix(reticle.matrix);
          } else {
            const cam = camera;
            if (cam) {
              const dir = new THREE.Vector3();
              cam.getWorldDirection(dir);
              const pos = new THREE.Vector3();
              cam.getWorldPosition(pos);
              obj.position.copy(pos).add(dir.multiplyScalar(1.0));
              obj.quaternion.copy(cam.quaternion);
              setStatus('Reticle not appearing; object placed in front of camera. Move camera to a flat surface to show reticle for precise placement.');
            } else {
              setStatus('Flat surface not found. Move camera slowly until reticle (circle) appears, then tap.');
            }
          }

          scene.add(obj);
          placedObject = obj;
        };

        renderer.xr.addEventListener('sessionstart', () => {
          const session = renderer?.xr.getSession();
          if (!session) return;
          activeSession = session;
          session.addEventListener('select', onSelect);
          hitTestSourceRequested = false;
          hitTestSource = null;
          setStatus('AR active. Point camera at a flat surface, wait for reticle, then tap to place object.');
        });

        renderer.xr.addEventListener('sessionend', () => {
          hitTestSourceRequested = false;
          try {
            activeSession?.removeEventListener('select', onSelect);
          } catch {
            // ignore
          }
          activeSession = null;

          try {
            hitTestSource?.cancel();
          } catch {
            // ignore
          }
          hitTestSource = null;
          refSpace = null;
          if (reticle) reticle.visible = false;

          if (scene && placedObject) {
            scene.remove(placedObject);
            placedObject = null;
          }

          setStatus('AR stopped. You can click Start AR again.');

          // Recreate ARButton to avoid "must refresh page" on some devices.
          try {
            mountArButton();
          } catch {
            // ignore
          }
        });

        const applySize = () => {
          if (!renderer || !camera || !host) return;
          // Avoid touching renderer/camera sizing while in an immersive XR session.
          // On some Android devices this can lead to freezes / pose updates stopping.
          if (renderer.xr.isPresenting) return;
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
            // Basic tracking-loss detection: if we can't get a viewer pose, AR tracking is temporarily lost.
            // This often happens with low light / fast motion / no visual features.
            const rs = refSpace;
            if (rs) {
              try {
                const vp = frame.getViewerPose(rs);
                if (!vp) {
                  const now = Date.now();
                  if (now - lastTrackingMessageAt > 1500) {
                    lastTrackingMessageAt = now;
                    setStatus('AR tracking lost. Try adding light, move camera slowly, and point at textured surfaces.');
                  }
                }
              } catch {
                // ignore
              }
            }

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
                .requestReferenceSpace('local-floor')
                .then((space: XRReferenceSpace) => {
                  refSpace = space;
                })
                .catch(() => {
                  session
                    .requestReferenceSpace('local')
                    .then((space: XRReferenceSpace) => {
                      refSpace = space;
                    })
                    .catch(() => {
                      // ignore
                    });
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
                  (reticle as any).matrixWorldNeedsUpdate = true;
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
        setStatus(e instanceof Error ? e.message : 'Failed to initialize WebXR AR');
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
            <div className="text-sm font-semibold">WebXR not ready</div>
            <div className="mt-1 text-xs text-white/85">{status || 'Cannot start WebXR AR.'}</div>
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
            ? 'WebXR AR usually runs on Android Chrome (HTTPS/localhost). On Windows webcam, only 2D overlay is available.'
            : status}
        </div>
        {diagnostic ? <div className="mt-1 text-[10px] text-white/60">{diagnostic}</div> : null}
      </div>
    </div>
  );
}
