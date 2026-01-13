'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Webcam from 'react-webcam';
import WebXRArViewer from '@/components/ar/WebXRArViewer';

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
  explain?: string;
  explainVer?: string;
};

type Graph2dLinearEq = { a: number; b: number; c: number };
type Graph2dLinearSystemOverlay = {
  kind: 'graph_2d_linear_system';
  eq1: Graph2dLinearEq;
  eq2?: Graph2dLinearEq;
  xRange?: [number, number];
  yRange?: [number, number];
  showIntersection?: boolean;
  showGrid?: boolean;
};

type BalanceScaleOverlay = {
  kind: 'balance_scale_equation';
  left: string;
  right: string;
  highlight?: string;
};

function isGraph2dLinearSystemOverlay(x: unknown): x is Graph2dLinearSystemOverlay {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.kind !== 'graph_2d_linear_system') return false;
  const eq1 = o.eq1 as Record<string, unknown> | undefined;
  if (!eq1) return false;
  const a = eq1.a;
  const b = eq1.b;
  const c = eq1.c;
  return typeof a === 'number' && typeof b === 'number' && typeof c === 'number';
}

function isBalanceScaleOverlay(x: unknown): x is BalanceScaleOverlay {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.kind !== 'balance_scale_equation') return false;
  return typeof o.left === 'string' && typeof o.right === 'string';
}

function solve2x2(eq1: Graph2dLinearEq, eq2: Graph2dLinearEq): { x: number; y: number } | null {
  // eq: a*x + b*y = c
  const det = eq1.a * eq2.b - eq2.a * eq1.b;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;
  const x = (eq1.c * eq2.b - eq2.c * eq1.b) / det;
  const y = (eq1.a * eq2.c - eq2.a * eq1.c) / det;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function linePointsForRange(eq: Graph2dLinearEq, xMin: number, xMax: number): Array<{ x: number; y: number }> {
  // a*x + b*y = c
  // if b != 0 => y = (c - a*x)/b
  // if b == 0 => vertical line x = c/a
  if (Math.abs(eq.b) > 1e-9) {
    return [
      { x: xMin, y: (eq.c - eq.a * xMin) / eq.b },
      { x: xMax, y: (eq.c - eq.a * xMax) / eq.b },
    ];
  }

  // vertical
  const x = Math.abs(eq.a) > 1e-9 ? eq.c / eq.a : 0;
  return [
    { x, y: -999 },
    { x, y: 999 },
  ];
}

function buildSimpleStepsFromText(text: string, maxSteps: number): string[] {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  // Split by sentence-ish boundaries for simple “activity steps”.
  const candidates = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Prefer shorter, actionable-ish lines.
  const short = candidates.filter((s) => s.length >= 20 && s.length <= 140);
  const base = (short.length >= 3 ? short : candidates).slice(0, maxSteps);

  // Convert into imperative-ish prompts.
  return base.map((s, idx) => {
    const prefix = idx === 0 ? 'Amati' : idx === 1 ? 'Coba' : 'Lanjutkan';
    return `${prefix}: ${s}`;
  });
}

export default function KinestheticARPanel({
  title,
  materialId,
  materialText,
}: {
  title: string;
  materialId: string;
  materialText: string;
}) {
  const AR_VIDEO_DEVICE_STORAGE_KEY = 'preferred-ar-video-device-id';
  const [active, setActive] = useState(false);
  const [recipe, setRecipe] = useState<ArRecipe | null>(null);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);
  const [recipeError, setRecipeError] = useState<string | null>(null);

  const [arExplanation, setArExplanation] = useState<string>('');
  const [isLoadingExplain, setIsLoadingExplain] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const [mirrored, setMirrored] = useState(true);
  const [visualOverlayEnabled, setVisualOverlayEnabled] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.9);
  const [instructionsVisible, setInstructionsVisible] = useState(true);
  const [webxr3dEnabled, setWebxr3dEnabled] = useState(false);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');
  const [deviceInitError, setDeviceInitError] = useState<string | null>(null);

  const fallbackSteps = useMemo(() => buildSimpleStepsFromText(materialText, 5), [materialText]);

  const steps = recipe?.steps?.length ? recipe.steps : fallbackSteps;

  const ensureExplanation = async ({ force }: { force?: boolean } = {}): Promise<void> => {
    if (!materialId) return;
    if (arExplanation && !force) return;

    // If the cached recipe already contains explanation, use it.
    if (recipe?.explain && !force) {
      setArExplanation(recipe.explain);
      return;
    }

    setIsLoadingExplain(true);
    setExplainError(null);
    if (typeof window !== 'undefined') {
      console.debug('[AR] ensureExplanation', { materialId, force: Boolean(force) });
    }

    try {
      const res = await fetch(
        `/api/student/material/${materialId}/ar-explain${force ? '?force=1' : ''}`,
        { credentials: 'include' }
      );

      if (!res.ok) {
        let msg = `Gagal membuat penjelasan (HTTP ${res.status})`;
        try {
          const body = (await res.json()) as { error?: string; message?: string };
          msg = body?.message || body?.error || msg;
        } catch {
          // ignore
        }
        setExplainError(msg);
        if (typeof window !== 'undefined') {
          console.error('[AR] Failed to fetch explanation', { materialId, status: res.status, msg });
        }
        return;
      }

      const json = (await res.json()) as {
        explanation?: string;
        source?: 'cache' | 'generated' | 'forced';
        version?: string;
      };

      const explanation = typeof json?.explanation === 'string' ? json.explanation.trim() : '';
      if (explanation) {
        setArExplanation(explanation);
        if (typeof window !== 'undefined') {
          console.groupCollapsed('[AR] Explanation loaded');
          console.info('meta', { materialId, source: json.source, version: json.version, force: Boolean(force) });
          console.info('explanation', explanation);
          console.groupEnd();
        }
      } else {
        setExplainError('Penjelasan kosong. Coba klik “Regenerate penjelasan”.');
      }
    } catch (e) {
      setExplainError(e instanceof Error ? e.message : 'Gagal membuat penjelasan AR.');
      if (typeof window !== 'undefined') {
        console.error('[AR] ensureExplanation exception', { materialId, error: e });
      }
    } finally {
      setIsLoadingExplain(false);
    }
  };

  const ensureRecipe = async ({ force }: { force?: boolean } = {}): Promise<void> => {
    if (recipe && !force) return;
    if (!materialId) return;
    setIsLoadingRecipe(true);
    setRecipeError(null);
    if (typeof window !== 'undefined') {
      console.debug('[AR] ensureRecipe', { materialId, force: Boolean(force) });
    }
    try {
      const res = await fetch(
        `/api/student/material/${materialId}/ar-recipe${force ? '?force=1' : ''}`,
        {
        credentials: 'include',
        }
      );

      if (!res.ok) {
        let msg = `Gagal menyiapkan AR (HTTP ${res.status})`;
        try {
          const body = (await res.json()) as { error?: string; message?: string };
          msg = body?.message || body?.error || msg;
        } catch {
          // ignore
        }

        setRecipeError(msg);
        if (typeof window !== 'undefined') {
          console.error('[AR] Failed to fetch recipe', {
            materialId,
            status: res.status,
            message: msg,
            force: Boolean(force),
          });
        }
        return;
      }

      const json = (await res.json()) as {
        arRecipe?: ArRecipe;
        source?: 'cache' | 'generated' | 'forced';
        version?: string;
        materialId?: string;
      };
      if (json?.arRecipe) {
        setRecipe(json.arRecipe);
        setArExplanation('');
        setExplainError(null);
        if (typeof window !== 'undefined') {
          console.groupCollapsed('[AR] Recipe loaded');
          console.info('meta', {
            materialId: json.materialId || materialId,
            source: json.source,
            version: json.version,
            force: Boolean(force),
          });
          console.info('recipe', json.arRecipe);
          console.info('overlayKind', (json.arRecipe.overlay as any)?.kind);
          console.groupEnd();
        }

        // Fire-and-forget explanation generation for a better UX.
        void ensureExplanation();
      } else {
        setRecipeError('AR recipe kosong. Coba klik “Buat AR”.');
        if (typeof window !== 'undefined') {
          console.warn('[AR] Recipe response missing arRecipe', { materialId, force: Boolean(force), json });
        }
      }
    } catch (e) {
      setRecipeError(
        e instanceof Error
          ? e.message
          : 'Gagal menyiapkan AR. Coba refresh halaman dan pastikan sudah login.'
      );
      if (typeof window !== 'undefined') {
        console.error('[AR] ensureRecipe exception', { materialId, force: Boolean(force), error: e });
      }
    } finally {
      setIsLoadingRecipe(false);
    }
  };

  const refreshVideoDevices = useCallback(async () => {
    setDeviceInitError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setDeviceInitError('Browser tidak mendukung akses kamera (mediaDevices).');
      return;
    }

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setDeviceInitError(
        'Akses kamera diblokir karena koneksi tidak aman (HTTP). Untuk HP, gunakan HTTPS (mis. tunnel) atau buka via Chrome dan aktifkan opsi insecure-origin jika terpaksa.'
      );
      return;
    }

    try {
      // Trigger permission prompt so device labels are visible.
      const tmpStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      tmpStream.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(videos);

      const saved = (() => {
        try {
          return window.localStorage.getItem(AR_VIDEO_DEVICE_STORAGE_KEY) || '';
        } catch {
          return '';
        }
      })();

      const hasSaved = saved && videos.some((d) => d.deviceId === saved);
      if (hasSaved) {
        setSelectedVideoDeviceId(saved);
        return;
      }

      // Heuristic: prefer DroidCam / non-PhoneLink cameras when available.
      const pickByLabel = (re: RegExp) => videos.find((d) => re.test((d.label || '').toLowerCase()));
      const droid = pickByLabel(/droid\s*cam|droidcam/);
      const integrated = pickByLabel(/integrated|built-in|builtin/);
      const usb = pickByLabel(/usb/);
      const back = pickByLabel(/back|rear|environment/);
      const notPhoneLink = videos.find((d) => !/phone\s*link|your\s*phone/.test((d.label || '').toLowerCase()));

      // For AR on phones, prefer the back camera when detectable.
      const picked = back || droid || integrated || usb || notPhoneLink || videos[0];
      setSelectedVideoDeviceId(picked?.deviceId || '');
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Gagal mengakses kamera.';
      const msg = raw.toLowerCase().includes('not implemented')
        ? 'getUserMedia tidak tersedia di browser ini. Coba pakai Google Chrome (bukan in-app browser seperti Instagram/Telegram) dan izinkan kamera.'
        : raw;
      setDeviceInitError(msg);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void refreshVideoDevices();
  }, [active, refreshVideoDevices]);

  useEffect(() => {
    if (!selectedVideoDeviceId) return;
    try {
      window.localStorage.setItem(AR_VIDEO_DEVICE_STORAGE_KEY, selectedVideoDeviceId);
    } catch {
      // ignore
    }
  }, [selectedVideoDeviceId]);

  const videoConstraints = useMemo(() => {
    if (selectedVideoDeviceId) {
      return {
        deviceId: { exact: selectedVideoDeviceId },
      } as MediaTrackConstraints;
    }

    // Mobile-friendly default
    return {
      facingMode: { ideal: 'environment' },
    } as MediaTrackConstraints;
  }, [selectedVideoDeviceId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const m = window.localStorage.getItem('ar-mirrored');
      const v = window.localStorage.getItem('ar-visual-overlay');
      const o = window.localStorage.getItem('ar-overlay-opacity');
      const ins = window.localStorage.getItem('ar-instructions');
      const xr3d = window.localStorage.getItem('ar-webxr-3d');
      if (m === '0' || m === '1') setMirrored(m === '1');
      if (v === '0' || v === '1') setVisualOverlayEnabled(v === '1');
      if (ins === '0' || ins === '1') setInstructionsVisible(ins === '1');
      if (xr3d === '0' || xr3d === '1') setWebxr3dEnabled(xr3d === '1');
      if (o) {
        const parsed = Number(o);
        if (Number.isFinite(parsed) && parsed >= 0.2 && parsed <= 1) setOverlayOpacity(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('ar-mirrored', mirrored ? '1' : '0');
      window.localStorage.setItem('ar-visual-overlay', visualOverlayEnabled ? '1' : '0');
      window.localStorage.setItem('ar-overlay-opacity', String(overlayOpacity));
      window.localStorage.setItem('ar-instructions', instructionsVisible ? '1' : '0');
      window.localStorage.setItem('ar-webxr-3d', webxr3dEnabled ? '1' : '0');
    } catch {
      // ignore
    }
  }, [instructionsVisible, mirrored, overlayOpacity, visualOverlayEnabled, webxr3dEnabled]);

  const overlayTemplate = recipe?.template;
  const overlayTitle = recipe?.shortGoal || 'Ikuti langkah di bawah.';

  const renderVisualOverlay = () => {
    if (!visualOverlayEnabled) return null;
    if (!overlayTemplate) return null;

    // Lightweight “AR feel”: static SVG overlay hints (no marker tracking).
    // This ensures the user sees something *on the camera*.
    const common = (
      <>
        <div className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[11px] text-white">
          <span className="font-semibold">AR Overlay</span>
          <span className="text-white/80"> · {overlayTemplate}</span>
        </div>
        <div className="absolute right-3 top-3 max-w-[60%] rounded-md bg-black/45 px-2 py-1 text-[11px] text-white/95">
          {overlayTitle}
        </div>
      </>
    );

    const style = { opacity: overlayOpacity } as React.CSSProperties;

    if (overlayTemplate === 'balance_scale') {
      const overlay = recipe?.overlay;
      const leftRight = isBalanceScaleOverlay(overlay)
        ? { left: overlay.left, right: overlay.right, highlight: overlay.highlight }
        : { left: 'Persamaan kiri', right: 'Persamaan kanan', highlight: undefined };

      return (
        <div className="absolute inset-0 pointer-events-none" style={style}>
          {common}
          <svg className="absolute inset-0" viewBox="0 0 1000 560" preserveAspectRatio="none">
            <line x1="500" y1="90" x2="500" y2="420" stroke="rgba(255,255,255,0.8)" strokeWidth="6" />
            <line x1="260" y1="160" x2="740" y2="160" stroke="rgba(255,255,255,0.85)" strokeWidth="8" />
            <line x1="320" y1="160" x2="280" y2="260" stroke="rgba(255,255,255,0.6)" strokeWidth="4" />
            <line x1="680" y1="160" x2="720" y2="260" stroke="rgba(255,255,255,0.6)" strokeWidth="4" />
            <rect x="210" y="260" width="180" height="90" rx="10" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
            <rect x="610" y="260" width="180" height="90" rx="10" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
            <text x="300" y="305" textAnchor="middle" fill="rgba(255,255,255,0.95)" fontSize="18">{leftRight.left}</text>
            <text x="700" y="305" textAnchor="middle" fill="rgba(255,255,255,0.95)" fontSize="18">{leftRight.right}</text>
            <text x="500" y="520" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="18">
              {leftRight.highlight || 'Tulis persamaan → pindahkan suku → isolasi variabel'}
            </text>
          </svg>
        </div>
      );
    }

    if (overlayTemplate === 'number_line') {
      return (
        <div className="absolute inset-0 pointer-events-none" style={style}>
          {common}
          <svg className="absolute inset-0" viewBox="0 0 1000 560" preserveAspectRatio="none">
            <line x1="120" y1="330" x2="880" y2="330" stroke="rgba(255,255,255,0.85)" strokeWidth="6" />
            {[...Array(9)].map((_, i) => {
              const x = 160 + i * 85;
              return (
                <line key={x} x1={x} y1="310" x2={x} y2="350" stroke="rgba(255,255,255,0.75)" strokeWidth="4" />
              );
            })}
            <path d="M 470 290 Q 520 240 580 290" fill="none" stroke="rgba(80,200,255,0.9)" strokeWidth="6" />
            <polygon points="580,290 560,285 565,305" fill="rgba(80,200,255,0.9)" />
            <text x="500" y="240" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="18">Lompat + / - di garis bilangan</text>
          </svg>
        </div>
      );
    }

    if (overlayTemplate === 'graph_2d') {
      const overlay = recipe?.overlay;
      const cfg = isGraph2dLinearSystemOverlay(overlay)
        ? overlay
        : ({
            kind: 'graph_2d_linear_system',
            eq1: { a: 1, b: 1, c: 2 },
            eq2: { a: 1, b: -1, c: 0 },
            showIntersection: true,
            showGrid: true,
          } satisfies Graph2dLinearSystemOverlay);

      const [xMin, xMax] = cfg.xRange && cfg.xRange[0] < cfg.xRange[1] ? cfg.xRange : ([-10, 10] as const);
      const [yMin, yMax] = cfg.yRange && cfg.yRange[0] < cfg.yRange[1] ? cfg.yRange : ([-10, 10] as const);

      const p1 = linePointsForRange(cfg.eq1, xMin, xMax);
      const p2 = cfg.eq2 ? linePointsForRange(cfg.eq2, xMin, xMax) : null;

      const intersection = cfg.eq2 ? solve2x2(cfg.eq1, cfg.eq2) : null;
      const showIntersection = cfg.showIntersection !== false && !!intersection;
      const showGrid = cfg.showGrid !== false;

      // Map math coordinates to SVG viewport (graph region)
      const gx0 = 200;
      const gy0 = 120;
      const gx1 = 820;
      const gy1 = 440;
      const sx = (x: number) => gx0 + ((x - xMin) / (xMax - xMin)) * (gx1 - gx0);
      const sy = (y: number) => gy1 - ((y - yMin) / (yMax - yMin)) * (gy1 - gy0);

      const line1 = `M ${sx(p1[0].x)} ${sy(p1[0].y)} L ${sx(p1[1].x)} ${sy(p1[1].y)}`;
      const line2 =
        p2 && `M ${sx(p2[0].x)} ${sy(p2[0].y)} L ${sx(p2[1].x)} ${sy(p2[1].y)}`;

      return (
        <div className="absolute inset-0 pointer-events-none" style={style}>
          {common}
          <svg className="absolute inset-0" viewBox="0 0 1000 560" preserveAspectRatio="none">
            <rect x="190" y="110" width="650" height="350" rx="12" fill="rgba(0,0,0,0.15)" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />

            {showGrid &&
              [...Array(11)].map((_, i) => {
                const t = i / 10;
                const x = gx0 + t * (gx1 - gx0);
                const y = gy0 + t * (gy1 - gy0);
                return (
                  <g key={i}>
                    <line x1={x} y1={gy0} x2={x} y2={gy1} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                    <line x1={gx0} y1={y} x2={gx1} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                  </g>
                );
              })}

            {/* Axes */}
            <line x1={sx(0)} y1={gy0} x2={sx(0)} y2={gy1} stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
            <line x1={gx0} y1={sy(0)} x2={gx1} y2={sy(0)} stroke="rgba(255,255,255,0.4)" strokeWidth="2" />

            {/* Lines */}
            <path d={line1} stroke="rgba(255,120,120,0.95)" strokeWidth="5" fill="none" />
            {line2 ? <path d={line2} stroke="rgba(80,200,255,0.95)" strokeWidth="5" fill="none" /> : null}

            {/* Intersection */}
            {showIntersection && intersection ? (
              <g>
                <circle cx={sx(intersection.x)} cy={sy(intersection.y)} r="7" fill="rgba(255,255,255,0.95)" />
                <circle cx={sx(intersection.x)} cy={sy(intersection.y)} r="12" fill="rgba(255,255,255,0.15)" />
                <text
                  x={sx(intersection.x) + 10}
                  y={sy(intersection.y) - 10}
                  fill="rgba(255,255,255,0.92)"
                  fontSize="16"
                >
                  ({intersection.x.toFixed(2)}, {intersection.y.toFixed(2)})
                </text>
              </g>
            ) : null}

            <text x="520" y="150" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="18">
              Grafik dari persamaan (a·x + b·y = c)
            </text>
          </svg>
        </div>
      );
    }

    if (overlayTemplate === 'fraction_blocks') {
      return (
        <div className="absolute inset-0 pointer-events-none" style={style}>
          {common}
          <svg className="absolute inset-0" viewBox="0 0 1000 560" preserveAspectRatio="none">
            <rect x="240" y="180" width="520" height="90" rx="10" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.65)" strokeWidth="2" />
            <rect x="240" y="300" width="520" height="90" rx="10" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.65)" strokeWidth="2" />
            {[...Array(6)].map((_, i) => {
              const x = 240 + i * (520 / 6);
              return (
                <line key={x} x1={x} y1="180" x2={x} y2="270" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
              );
            })}
            <rect x="240" y="180" width={(520 / 6) * 3} height="90" rx="10" fill="rgba(120,220,120,0.35)" />
            <text x="520" y="160" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="18">Warnai bagian pecahan</text>
          </svg>
        </div>
      );
    }

    if (overlayTemplate === 'algebra_tiles') {
      return (
        <div className="absolute inset-0 pointer-events-none" style={style}>
          {common}
          <svg className="absolute inset-0" viewBox="0 0 1000 560" preserveAspectRatio="none">
            <rect x="260" y="170" width="160" height="160" rx="8" fill="rgba(80,200,255,0.25)" stroke="rgba(80,200,255,0.8)" strokeWidth="3" />
            <rect x="460" y="210" width="80" height="120" rx="8" fill="rgba(255,180,80,0.25)" stroke="rgba(255,180,80,0.85)" strokeWidth="3" />
            <rect x="570" y="240" width="80" height="90" rx="8" fill="rgba(255,80,120,0.20)" stroke="rgba(255,80,120,0.75)" strokeWidth="3" />
            <text x="340" y="360" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="18">x²</text>
            <text x="500" y="360" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="18">x</text>
            <text x="610" y="360" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="18">1</text>
            <text x="520" y="150" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="18">Gabungkan ubin sejenis</text>
          </svg>
        </div>
      );
    }

    // generic_overlay
    return (
      <div className="absolute inset-0 pointer-events-none" style={style}>
        {common}
        <svg className="absolute inset-0" viewBox="0 0 1000 560" preserveAspectRatio="none">
          <rect x="80" y="70" width="840" height="420" rx="14" fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
          <line x1="500" y1="120" x2="500" y2="440" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
          <line x1="160" y1="280" x2="840" y2="280" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
          <text x="500" y="520" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="18">Arahkan kamera ke buku/layar materi</text>
        </svg>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-gray-500">Mode Kinestetik</div>
          <div className="font-semibold text-gray-900">AR Pendamping: {title}</div>
        </div>
        <button
          onClick={() => {
            const next = !active;
            setActive(next);
            if (next) {
              // Trigger permission prompt from user gesture
              void refreshVideoDevices();
              void ensureRecipe();
              void ensureExplanation();
            }
          }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            active
              ? 'bg-gray-700 hover:bg-gray-800 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {active ? 'Tutup AR' : isLoadingRecipe ? 'Menyiapkan…' : 'Mulai AR'}
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Ini AR ringan berbasis kamera (browser) + overlay instruksi. Konten teks tetap jadi patokan.
      </p>

      {active && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void ensureRecipe()}
              className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-gray-50"
              disabled={isLoadingRecipe}
            >
              {isLoadingRecipe ? 'Menyiapkan AR…' : recipe ? 'AR Siap' : 'Buat AR'}
            </button>
            {recipe ? (
              <button
                type="button"
                onClick={() => {
                  setRecipe(null);
                  void ensureRecipe({ force: true });
                }}
                className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-gray-50"
                disabled={isLoadingRecipe}
                title="Regenerate AR jika overlay tidak sesuai atau prompt/schema baru"
              >
                Regenerate
              </button>
            ) : null}
            {recipeError ? <span className="text-xs text-red-600">{recipeError}</span> : null}
            {!recipeError && isLoadingRecipe ? (
              <span className="text-xs text-gray-600">
                Jika pertama kali, bisa butuh beberapa detik.
              </span>
            ) : null}
          </div>

          {recipe && (
            <div className="mb-3 text-sm text-gray-700">
              <span className="font-medium text-gray-900">Template:</span>{' '}
              <span className="text-gray-800">{recipe.template}</span>
              {recipe.shortGoal ? (
                <span className="text-gray-500"> — {recipe.shortGoal}</span>
              ) : null}
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-gray-700">Pilih kamera:</label>
            <select
              value={selectedVideoDeviceId}
              onChange={(e) => setSelectedVideoDeviceId(e.target.value)}
              className="text-xs border rounded-md px-2 py-1 bg-white"
            >
              {videoDevices.length === 0 ? (
                <option value="">(memuat daftar kamera…)</option>
              ) : (
                videoDevices.map((d, idx) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${idx + 1}`}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => void refreshVideoDevices()}
              className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-gray-50"
            >
              Refresh
            </button>
            {deviceInitError ? (
              <span className="text-xs text-red-600">{deviceInitError}</span>
            ) : null}
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-gray-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={webxr3dEnabled}
                onChange={(e) => setWebxr3dEnabled(e.target.checked)}
              />
              3D WebXR
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={visualOverlayEnabled}
                onChange={(e) => setVisualOverlayEnabled(e.target.checked)}
                disabled={webxr3dEnabled}
              />
              Overlay visual
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={instructionsVisible}
                onChange={(e) => setInstructionsVisible(e.target.checked)}
                disabled={webxr3dEnabled}
              />
              Instruksi
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={mirrored}
                onChange={(e) => setMirrored(e.target.checked)}
                disabled={webxr3dEnabled}
              />
              Mirror
            </label>
            <label className="inline-flex items-center gap-2">
              Opacity
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.1}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                disabled={webxr3dEnabled}
              />
            </label>
          </div>

          <div className="relative w-full aspect-video overflow-hidden rounded-lg border bg-black">
            {webxr3dEnabled ? (
              <div className="absolute inset-0">
                <WebXRArViewer recipe={recipe} />
              </div>
            ) : (
              <>
                <Webcam
                  key={selectedVideoDeviceId || 'default'}
                  audio={false}
                  mirrored={mirrored}
                  className="absolute inset-0 w-full h-full object-cover"
                  videoConstraints={{
                    ...videoConstraints,
                  }}
                  onUserMedia={() => {
                    if (typeof window !== 'undefined') {
                      console.debug('[AR] Webcam userMedia ok');
                    }
                  }}
                  onUserMediaError={(err) => {
                    const raw = String((err as any)?.message || err || '');
                    const msg =
                      typeof window !== 'undefined' && window.isSecureContext === false
                        ? 'Akses kamera diblokir karena koneksi tidak aman (HTTP). Untuk HP, gunakan HTTPS (tunnel) atau buka via localhost.'
                        : raw.toLowerCase().includes('not implemented')
                          ? 'getUserMedia tidak tersedia di browser ini. Coba pakai Google Chrome (bukan in-app browser) dan izinkan kamera.'
                          : 'Gagal mengakses kamera. Cek izin kamera di browser.';
                    setDeviceInitError(msg);
                    if (typeof window !== 'undefined') {
                      console.error('[AR] Webcam userMedia error', err);
                    }
                  }}
                />

                {renderVisualOverlay()}

                {instructionsVisible ? (
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-black/60 text-white">
                    <div className="text-sm font-semibold">Instruksi</div>
                    {steps.length > 0 ? (
                      <ol className="mt-1 text-xs space-y-1 list-decimal list-inside">
                        {steps.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                    ) : (
                      <div className="mt-1 text-xs">Instruksi belum tersedia untuk materi ini.</div>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-3 text-sm text-gray-700">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium text-gray-900">Penjelasan AR</div>
              <button
                type="button"
                onClick={() => void ensureExplanation({ force: true })}
                className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-gray-50"
                disabled={isLoadingExplain}
                title="Buat ulang penjelasan dengan AI"
              >
                {isLoadingExplain ? 'Membuat…' : 'Regenerate penjelasan'}
              </button>
            </div>

            {explainError ? <div className="mt-1 text-xs text-red-600">{explainError}</div> : null}

            <div className="mt-2 text-sm text-gray-700">
              {arExplanation ? (
                <p>{arExplanation}</p>
              ) : isLoadingExplain ? (
                <p className="text-gray-500">Menyiapkan penjelasan singkat…</p>
              ) : (
                <p className="text-gray-500">Klik “Regenerate penjelasan” untuk membuat penjelasan AR.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
