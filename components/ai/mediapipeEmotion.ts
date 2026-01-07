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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getBlendshapeScore(scores: BlendshapeScores, key: string): number {
  return typeof scores[key] === 'number' ? scores[key] : 0;
}

function toBlendshapeScores(result: any): BlendshapeScores {
  const scores: BlendshapeScores = {};

  // MediaPipe returns: result.faceBlendshapes?: Array<Array<{ categoryName, score }>>
  const faceBlendshapes = result?.faceBlendshapes;
  const firstFace = Array.isArray(faceBlendshapes) ? faceBlendshapes[0] : undefined;
  if (!Array.isArray(firstFace)) return scores;

  for (const item of firstFace) {
    const name = item?.categoryName;
    const score = item?.score;
    if (typeof name === 'string' && typeof score === 'number') {
      scores[name] = score;
    }
  }

  return scores;
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

  faceLandmarkerPromise = (async () => {
    const wasmBaseUrl =
      options?.wasmBaseUrl ??
      // Works for most setups; you can override with NEXT_PUBLIC_MEDIAPIPE_WASM_BASE_URL.
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

    const vision: FaceLandmarkerModule = await import('@mediapipe/tasks-vision');

    const filesetResolver = await vision.FilesetResolver.forVisionTasks(wasmBaseUrl);

    // Uses a hosted model asset provided by MediaPipe.
    const landmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          options?.modelAssetPath ||
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
    });

    return landmarker as unknown as FaceLandmarkerInstance;
  })();

  await faceLandmarkerPromise;
}

export async function detectEmotionWithMediaPipe(
  video: HTMLVideoElement,
  timestampMs: number
): Promise<MediaPipeEmotionResult | null> {
  if (!faceLandmarkerPromise) return null;

  const landmarker = await faceLandmarkerPromise;
  const result = landmarker.detectForVideo(video, timestampMs);

  const scores = toBlendshapeScores(result);
  if (Object.keys(scores).length === 0) return null;

  return inferEmotionFromBlendshapes(scores);
}
