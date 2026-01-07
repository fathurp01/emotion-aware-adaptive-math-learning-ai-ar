'use client';

import type { EmotionLabel } from '@/lib/store';

export type MediaPipeEmotionResult = {
  label: EmotionLabel;
  confidence: number;
};

type BlendshapeScores = Record<string, number>;

type FaceLandmarkerModule = typeof import('@mediapipe/tasks-vision');

type FaceLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => any;
  close?: () => void;
};

let faceLandmarkerPromise: Promise<FaceLandmarkerInstance> | null = null;

// Keep in sync with package.json to avoid CDN "@latest" mismatches.
const TASKS_VISION_VERSION = '0.10.22-rc.20250304';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getBlendshapeScore(scores: BlendshapeScores, key: string): number {
  return typeof scores[key] === 'number' ? scores[key] : 0;
}

function toBlendshapeScores(result: any): BlendshapeScores {
  const scores: BlendshapeScores = {};

  // tasks-vision has had a few result shapes across versions.
  // Common shapes:
  // 1) result.faceBlendshapes: Array<Array<{ categoryName, score }>>
  // 2) result.faceBlendshapes: Array<{ categories: Array<{ categoryName, score }> }>
  const faceBlendshapes = result?.faceBlendshapes;
  const first = Array.isArray(faceBlendshapes) ? faceBlendshapes[0] : undefined;

  const items: any[] = Array.isArray(first)
    ? first
    : Array.isArray(first?.categories)
      ? first.categories
      : [];

  for (const item of items) {
    const name = item?.categoryName;
    const score = item?.score;
    if (typeof name === 'string' && typeof score === 'number') {
      scores[name] = score;
    }
  }

  return scores;
}

function hasFaceLandmarks(result: any): boolean {
  const landmarks = result?.faceLandmarks;
  return Array.isArray(landmarks) && landmarks.length > 0;
}

function inferEmotionFromBlendshapes(scores: BlendshapeScores): MediaPipeEmotionResult {
  // Heuristic fallback mapping using common FaceLandmarker blendshape names.
  // This is NOT a trained emotion model; it is a best-effort fallback.

  const smile = Math.max(
    getBlendshapeScore(scores, 'mouthSmileLeft'),
    getBlendshapeScore(scores, 'mouthSmileRight')
  );
  const frown = Math.max(
    getBlendshapeScore(scores, 'mouthFrownLeft'),
    getBlendshapeScore(scores, 'mouthFrownRight')
  );
  const browDown = Math.max(
    getBlendshapeScore(scores, 'browDownLeft'),
    getBlendshapeScore(scores, 'browDownRight')
  );
  const browInnerUp = getBlendshapeScore(scores, 'browInnerUp');
  const eyeWide = Math.max(
    getBlendshapeScore(scores, 'eyeWideLeft'),
    getBlendshapeScore(scores, 'eyeWideRight')
  );
  const mouthStretch = Math.max(
    getBlendshapeScore(scores, 'mouthStretchLeft'),
    getBlendshapeScore(scores, 'mouthStretchRight')
  );
  const jawOpen = getBlendshapeScore(scores, 'jawOpen');
  const noseSneer = Math.max(
    getBlendshapeScore(scores, 'noseSneerLeft'),
    getBlendshapeScore(scores, 'noseSneerRight')
  );

  // Build simple emotion scores
  const happyScore = smile;
  const sadScore = clamp01(frown * 0.8 + browInnerUp * 0.4);
  const surprisedScore = clamp01(eyeWide * 0.7 + jawOpen * 0.6);
  const frustratedScore = clamp01(browDown * 0.7 + noseSneer * 0.5);
  const anxiousScore = clamp01(eyeWide * 0.6 + mouthStretch * 0.6);
  const confusedScore = clamp01(browInnerUp * 0.6 + browDown * 0.4);

  const candidates: Array<{ label: EmotionLabel; score: number }> = [
    { label: 'Happy', score: happyScore },
    { label: 'Sad', score: sadScore },
    { label: 'Surprised', score: surprisedScore },
    { label: 'Frustrated', score: frustratedScore },
    { label: 'Anxious', score: anxiousScore },
    { label: 'Confused', score: confusedScore },
  ];

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // Neutral if nothing stands out
  if (!best || best.score < 0.35) {
    return { label: 'Neutral', confidence: clamp01(best?.score ?? 0) };
  }

  return {
    label: best.label,
    confidence: clamp01(best.score),
  };
}

export async function initMediaPipeEmotionFallback(options?: {
  wasmBaseUrl?: string;
  modelAssetPath?: string;
}): Promise<void> {
  if (faceLandmarkerPromise) return;

  const wasmCandidates = options?.wasmBaseUrl
    ? [options.wasmBaseUrl]
    : [
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`,
        `https://unpkg.com/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`,
      ];

  const modelCandidates = options?.modelAssetPath
    ? [options.modelAssetPath]
    : [
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      ];

  faceLandmarkerPromise = (async () => {
    const vision: FaceLandmarkerModule = await import('@mediapipe/tasks-vision');

    let lastError: unknown = null;
    for (const wasmBaseUrl of wasmCandidates) {
      for (const modelAssetPath of modelCandidates) {
        try {
          const filesetResolver = await vision.FilesetResolver.forVisionTasks(wasmBaseUrl);
          const landmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath,
            },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: true,
          });

          return landmarker as unknown as FaceLandmarkerInstance;
        } catch (err) {
          lastError = err;
          // Try next candidate
        }
      }
    }

    const message =
      lastError instanceof Error
        ? lastError.message
        : 'Unknown MediaPipe init error';
    throw new Error(
      `MediaPipe FaceLandmarker init failed. ${message}. ` +
        `Tried wasmBaseUrl: ${wasmCandidates.join(' | ')} and modelAssetPath: ${modelCandidates.join(' | ')}. ` +
        `If your network blocks CDNs/Google Storage, set NEXT_PUBLIC_MEDIAPIPE_WASM_BASE_URL and NEXT_PUBLIC_MEDIAPIPE_FACE_LANDMARKER_MODEL_URL to self-hosted URLs.`
    );
  })();

  try {
    await faceLandmarkerPromise;
  } catch (err) {
    // Allow retry after a failed init.
    faceLandmarkerPromise = null;
    throw err;
  }
}

export async function detectEmotionWithMediaPipe(
  video: HTMLVideoElement,
  timestampMs: number
): Promise<MediaPipeEmotionResult | null> {
  if (!faceLandmarkerPromise) return null;

  let landmarker: FaceLandmarkerInstance;
  try {
    landmarker = await faceLandmarkerPromise;
  } catch (err) {
    // Init failed earlier; allow caller to continue without crashing.
    console.warn('MediaPipe fallback not available:', err);
    return null;
  }

  const result = landmarker.detectForVideo(video, timestampMs);

  const scores = toBlendshapeScores(result);
  if (Object.keys(scores).length === 0) {
    // If landmarks exist but blendshapes are missing, we still consider the face detected.
    // Return a low-confidence Neutral so the UI can show activity.
    if (hasFaceLandmarks(result)) {
      return { label: 'Neutral', confidence: 0.05 };
    }
    return null;
  }

  return inferEmotionFromBlendshapes(scores);
}
