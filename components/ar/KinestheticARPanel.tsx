'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Webcam from 'react-webcam';

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
  const [active, setActive] = useState(false);
  const [recipe, setRecipe] = useState<ArRecipe | null>(null);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');
  const [deviceInitError, setDeviceInitError] = useState<string | null>(null);

  const fallbackSteps = useMemo(() => buildSimpleStepsFromText(materialText, 5), [materialText]);

  const steps = recipe?.steps?.length ? recipe.steps : fallbackSteps;

  const ensureRecipe = async (): Promise<void> => {
    if (recipe) return;
    setIsLoadingRecipe(true);
    try {
      const res = await fetch(`/api/student/material/${materialId}/ar-recipe`);
      if (!res.ok) throw new Error('Failed to fetch AR recipe');
      const json = (await res.json()) as { arRecipe?: ArRecipe };
      if (json?.arRecipe) setRecipe(json.arRecipe);
    } catch {
      // fallback to heuristic steps
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

    try {
      // Trigger permission prompt so device labels are visible.
      const tmpStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tmpStream.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(videos);

      const saved = (() => {
        try {
          return window.localStorage.getItem('preferred-video-device-id') || '';
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
      const notPhoneLink = videos.find((d) => !/phone\s*link|your\s*phone/.test((d.label || '').toLowerCase()));

      const picked = droid || integrated || usb || notPhoneLink || videos[0];
      setSelectedVideoDeviceId(picked?.deviceId || '');
    } catch (e) {
      setDeviceInitError(
        e instanceof Error
          ? e.message
          : 'Gagal mengakses kamera. Pastikan izin kamera diizinkan untuk situs ini.'
      );
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void refreshVideoDevices();
  }, [active, refreshVideoDevices]);

  useEffect(() => {
    if (!selectedVideoDeviceId) return;
    try {
      window.localStorage.setItem('preferred-video-device-id', selectedVideoDeviceId);
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
            if (next) void ensureRecipe();
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

          <div className="relative w-full aspect-video overflow-hidden rounded-lg border bg-black">
            <Webcam
              key={selectedVideoDeviceId || 'default'}
              audio={false}
              mirrored={true}
              className="absolute inset-0 w-full h-full object-cover"
              videoConstraints={{
                ...videoConstraints,
              }}
            />

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
          </div>

          <div className="mt-3 text-sm text-gray-700">
            <div className="font-medium text-gray-900">Aktivitas cepat</div>
            <ul className="mt-1 text-sm text-gray-700 list-disc list-inside space-y-1">
              <li>Tunjuk bagian materi yang sedang dibahas di layar.</li>
              <li>Ulangi langkah penyelesaian sambil mengucapkan nilai variabelnya.</li>
              <li>Jika ada contoh soal, coba ubah angkanya dan amati perubahannya.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
