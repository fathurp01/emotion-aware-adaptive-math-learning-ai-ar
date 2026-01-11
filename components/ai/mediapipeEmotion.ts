'use client';

import type { EmotionLabel } from '@/lib/store';

export type MediaPipeEmotionResult = {
  label: EmotionLabel;
  confidence: number;
  debug?: {
    positiveScore?: number;
    negativeScore?: number;
    browProximity?: number;
    handsAvailable?: boolean;
    handDetected?: boolean;
    handOnCheekScore?: number;
    poseAvailable?: boolean;
    wristNearCheekScore?: number;
    cheekTouchScore?: number;
    handLandmarksCount?: number;
    poseLandmarksCount?: number;
    minHandCheekDistanceRatio?: number;
    minPoseCheekDistanceRatio?: number;
  };
};

type NormalizedLandmark = {
  x: number;
  y: number;
  z?: number;
};

type BlendshapeScores = Record<string, number>;

type FaceLandmarkerModule = typeof import('@mediapipe/tasks-vision');

type FaceLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => any;
  close?: () => void;
};

type HandsLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => any;
  close?: () => void;
};

type PoseLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => any;
  close?: () => void;
};

let faceLandmarkerPromise: Promise<FaceLandmarkerInstance> | null = null;
let handsLandmarkerPromise: Promise<HandsLandmarkerInstance | null> | null = null;
let poseLandmarkerPromise: Promise<PoseLandmarkerInstance | null> | null = null;

let handsInitStatus: 'uninitialized' | 'ready' | 'unavailable' = 'uninitialized';
let poseInitStatus: 'uninitialized' | 'ready' | 'unavailable' = 'uninitialized';

// Guard against concurrent detectForVideo calls on the same graph instances.
// Overlap can deliver timestamps out-of-order (e.g., ts=5001 then ts=5000), causing
// "Packet timestamp mismatch" errors and breaking the graph.
let detectInFlight = false;

// MediaPipe Tasks can share a single underlying WASM runner across multiple landmarkers.
// In that setup, timestamps must be strictly increasing *globally*, not just per landmarker.
// IMPORTANT: use integer milliseconds to avoid float rounding causing rare -1µs regressions
// inside the WASM timestamp conversion.
const lastGlobalTimestampMs = { value: 0 };

function monotonicTimestampMs(timestampMs: number): number {
  const ms = Number.isFinite(timestampMs) ? Math.floor(timestampMs) : 0;
  const nextMs = ms <= lastGlobalTimestampMs.value ? lastGlobalTimestampMs.value + 1 : ms;
  lastGlobalTimestampMs.value = nextMs;
  return nextMs;
}

function resetMediaPipeLandmarkers(reason: string, err?: unknown): void {
  console.warn('Resetting MediaPipe landmarkers:', reason, err);

  void faceLandmarkerPromise
    ?.then((lm) => lm?.close?.())
    .catch(() => undefined);
  void handsLandmarkerPromise
    ?.then((lm) => lm?.close?.())
    .catch(() => undefined);
  void poseLandmarkerPromise
    ?.then((lm) => lm?.close?.())
    .catch(() => undefined);

  faceLandmarkerPromise = null;
  handsLandmarkerPromise = null;
  poseLandmarkerPromise = null;
  handsInitStatus = 'uninitialized';
  poseInitStatus = 'uninitialized';
  lastGlobalTimestampMs.value = 0;
  detectInFlight = false;
}

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

function getFirstFaceLandmarks(result: any): NormalizedLandmark[] | null {
  const landmarks = result?.faceLandmarks;
  if (!Array.isArray(landmarks) || landmarks.length === 0) return null;
  const first = landmarks[0];
  return Array.isArray(first) ? (first as NormalizedLandmark[]) : null;
}

function distance2D(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function safeLandmark(landmarks: NormalizedLandmark[], index: number): NormalizedLandmark | null {
  const value = landmarks[index];
  if (!value) return null;
  if (typeof value.x !== 'number' || typeof value.y !== 'number') return null;
  return value;
}

type HandProximityInfo = {
  handDetected: boolean;
  handOnCheekScore: number; // 0..1
  minDistanceRatio: number | null;
};

type WristProximityInfo = {
  poseAvailable: boolean;
  wristNearCheekScore: number; // 0..1
  minDistanceRatio: number | null;
};

function getFirstHandLandmarks(result: any): NormalizedLandmark[] | null {
  // tasks-vision HandLandmarker result shape has varied across versions.
  // Common shapes:
  // - result.landmarks: NormalizedLandmark[][]
  // - result.handLandmarks: NormalizedLandmark[][]
  const landmarks = result?.handLandmarks ?? result?.landmarks;
  if (!Array.isArray(landmarks) || landmarks.length === 0) return null;
  const first = landmarks[0];
  return Array.isArray(first) ? (first as NormalizedLandmark[]) : null;
}

function computeBrowProximityScore(landmarks: NormalizedLandmark[]): number {
  // Heuristic requested: if left/right eyebrows are closer together, treat as more negative.
  // We normalize the brow gap by face width to be robust across camera distance.
  // Indices are for MediaPipe Face Mesh (468 landmarks) used by FaceLandmarker.
  // - Inner eyebrow points (approx): 70 (left), 300 (right)
  // - Face width points (cheeks): 234 (left), 454 (right)
  const leftBrowInner = safeLandmark(landmarks, 70);
  const rightBrowInner = safeLandmark(landmarks, 300);
  const leftCheek = safeLandmark(landmarks, 234);
  const rightCheek = safeLandmark(landmarks, 454);

  if (!leftBrowInner || !rightBrowInner || !leftCheek || !rightCheek) return 0;

  const faceWidth = distance2D(leftCheek, rightCheek);
  if (!Number.isFinite(faceWidth) || faceWidth <= 0) return 0;

  const browGap = distance2D(leftBrowInner, rightBrowInner);
  if (!Number.isFinite(browGap) || browGap <= 0) return 0;

  const ratio = browGap / faceWidth; // smaller => brows closer => more negative

  // Tunable thresholds (empirical). If you want it more sensitive, raise threshold or lower range.
  const threshold = 0.16;
  const range = 0.06;

  return clamp01((threshold - ratio) / range);
}

function computeHandOnCheekInfo(
  faceLandmarks: NormalizedLandmark[] | null,
  handLandmarks: NormalizedLandmark[] | null
): HandProximityInfo {
  if (!handLandmarks || handLandmarks.length === 0) {
    return { handDetected: false, handOnCheekScore: 0, minDistanceRatio: null };
  }
  if (!faceLandmarks || faceLandmarks.length === 0) {
    return { handDetected: true, handOnCheekScore: 0, minDistanceRatio: null };
  }

  const leftCheek = safeLandmark(faceLandmarks, 234);
  const rightCheek = safeLandmark(faceLandmarks, 454);
  if (!leftCheek || !rightCheek) {
    return { handDetected: true, handOnCheekScore: 0, minDistanceRatio: null };
  }

  const faceWidth = distance2D(leftCheek, rightCheek);
  if (!Number.isFinite(faceWidth) || faceWidth <= 0) {
    return { handDetected: true, handOnCheekScore: 0, minDistanceRatio: null };
  }

  // MediaPipe Hands has 21 landmarks. Use stable points to detect cheek-touch.
  // Include palm center (9) which is often closer to the cheek than fingertips.
  const handIndices = [0, 9, 4, 8, 12, 16, 20];
  let minDist = Number.POSITIVE_INFINITY;

  for (const idx of handIndices) {
    const p = safeLandmark(handLandmarks, idx);
    if (!p) continue;
    minDist = Math.min(minDist, distance2D(p, leftCheek), distance2D(p, rightCheek));
  }

  if (!Number.isFinite(minDist)) {
    return { handDetected: true, handOnCheekScore: 0, minDistanceRatio: null };
  }

  // Tunable threshold based on face width.
  // More permissive so "tangan menempel di pipi" triggers reliably.
  // Empirically, when the palm/fingers touch the cheek, the best landmark can still be
  // ~0.25-0.32 of face width away (due to perspective and occlusion).
  const touchThreshold = 0.42 * faceWidth;
  const touchRange = 0.28 * faceWidth;
  const handOnCheekScore = clamp01((touchThreshold - minDist) / touchRange);
  const minDistanceRatio = minDist / faceWidth;

  return { handDetected: true, handOnCheekScore, minDistanceRatio };
}

function getFirstPoseLandmarks(result: any): NormalizedLandmark[] | null {
  // tasks-vision PoseLandmarker result shape has varied across versions.
  // Common shapes:
  // - result.landmarks: NormalizedLandmark[][]
  // - result.poseLandmarks: NormalizedLandmark[][]
  const landmarks = result?.poseLandmarks ?? result?.landmarks;
  if (!Array.isArray(landmarks) || landmarks.length === 0) return null;
  const first = landmarks[0];
  return Array.isArray(first) ? (first as NormalizedLandmark[]) : null;
}

function computeWristNearCheekInfo(
  faceLandmarks: NormalizedLandmark[] | null,
  poseLandmarks: NormalizedLandmark[] | null
): WristProximityInfo {
  if (!poseLandmarks || poseLandmarks.length === 0) {
    return { poseAvailable: false, wristNearCheekScore: 0, minDistanceRatio: null };
  }
  if (!faceLandmarks || faceLandmarks.length === 0) {
    return { poseAvailable: true, wristNearCheekScore: 0, minDistanceRatio: null };
  }

  const leftCheek = safeLandmark(faceLandmarks, 234);
  const rightCheek = safeLandmark(faceLandmarks, 454);
  if (!leftCheek || !rightCheek) {
    return { poseAvailable: true, wristNearCheekScore: 0, minDistanceRatio: null };
  }

  const faceWidth = distance2D(leftCheek, rightCheek);
  if (!Number.isFinite(faceWidth) || faceWidth <= 0) {
    return { poseAvailable: true, wristNearCheekScore: 0, minDistanceRatio: null };
  }

  // BlazePose: elbows 13/14, wrists 15/16.
  // Elbows are often more stable when hand is occluded by the face.
  const leftElbow = safeLandmark(poseLandmarks, 13);
  const rightElbow = safeLandmark(poseLandmarks, 14);
  const leftWrist = safeLandmark(poseLandmarks, 15);
  const rightWrist = safeLandmark(poseLandmarks, 16);
  let minDist = Number.POSITIVE_INFINITY;
  for (const joint of [leftWrist, rightWrist, leftElbow, rightElbow]) {
    if (!joint) continue;
    minDist = Math.min(minDist, distance2D(joint, leftCheek), distance2D(joint, rightCheek));
  }
  if (!Number.isFinite(minDist)) {
    return { poseAvailable: true, wristNearCheekScore: 0, minDistanceRatio: null };
  }

  // Looser because pose wrist is less precise than hand landmarks.
  const touchThreshold = 0.22 * faceWidth;
  const touchRange = 0.14 * faceWidth;
  const wristNearCheekScore = clamp01((touchThreshold - minDist) / touchRange);
  return { poseAvailable: true, wristNearCheekScore, minDistanceRatio: minDist / faceWidth };
}

function inferEmotionFromBlendshapes(
  scores: BlendshapeScores,
  landmarks?: NormalizedLandmark[] | null,
  handInfo?: HandProximityInfo | null
): MediaPipeEmotionResult {
  // Heuristic fallback mapping using common FaceLandmarker blendshape names.
  // This is NOT a trained emotion model; it is a best-effort fallback.
  // We normalize to canonical 3-class labels to match the TFJS model.

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
  const _jawOpen = getBlendshapeScore(scores, 'jawOpen');
  const noseSneer = Math.max(
    getBlendshapeScore(scores, 'noseSneerLeft'),
    getBlendshapeScore(scores, 'noseSneerRight')
  );

  const browProximity = landmarks ? computeBrowProximityScore(landmarks) : 0;
  const handOnCheekScore = handInfo?.handOnCheekScore ?? 0;

  const positiveScore = clamp01(smile);

  // Negative correlates with frown/brow tension/eye widening (stress), etc.
  const negativeScore = clamp01(
    Math.max(
      frown * 0.9 + browInnerUp * 0.2,
      browDown * 0.8 + noseSneer * 0.6,
      eyeWide * 0.6 + mouthStretch * 0.6,
      // User-requested: tight eyebrows (brows closer together) => more negative.
      browProximity * 0.95 + browDown * 0.15
    )
  );

  const bestScore = Math.max(positiveScore, negativeScore);
  if (bestScore < 0.35) {
    return {
      label: 'Neutral',
      confidence: clamp01(bestScore),
      debug: {
        positiveScore,
        negativeScore,
        browProximity,
        handDetected: handInfo?.handDetected ?? false,
        handOnCheekScore,
      },
    };
  }

  if (positiveScore >= negativeScore) {
    return {
      label: 'Positive',
      confidence: clamp01(positiveScore),
      debug: {
        positiveScore,
        negativeScore,
        browProximity,
        handDetected: handInfo?.handDetected ?? false,
        handOnCheekScore,
      },
    };
  }

  return {
    label: 'Negative',
    confidence: clamp01(negativeScore),
    debug: {
      positiveScore,
      negativeScore,
      browProximity,
      handDetected: handInfo?.handDetected ?? false,
      handOnCheekScore,
    },
  };
}

export async function initMediaPipeEmotionFallback(options?: {
  wasmBaseUrl?: string;
  modelAssetPath?: string;
  handsModelAssetPath?: string;
  poseModelAssetPath?: string;
}): Promise<void> {
  // Allow calling init multiple times: face may already be initialized,
  // but hands may not (e.g., older sessions).
  if (faceLandmarkerPromise && handsLandmarkerPromise && poseLandmarkerPromise) return;

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

  const handsModelCandidates = options?.handsModelAssetPath
    ? [options.handsModelAssetPath]
    : [
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      ];

  const poseModelCandidates = options?.poseModelAssetPath
    ? [options.poseModelAssetPath]
    : [
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      ];

  const vision: FaceLandmarkerModule = await import('@mediapipe/tasks-vision');

  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
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
  }

  // Best-effort hands init. We don't fail face fallback if hands fails.
  if (!handsLandmarkerPromise) {
    handsLandmarkerPromise = (async () => {
      let lastHandsErr: unknown = null;
      for (const wasmBaseUrl of wasmCandidates) {
        try {
          const filesetResolver = await vision.FilesetResolver.forVisionTasks(wasmBaseUrl);
          for (const handsModelAssetPath of handsModelCandidates) {
            try {
              const hands = await vision.HandLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                  modelAssetPath: handsModelAssetPath,
                },
                runningMode: 'VIDEO',
                numHands: 2,
                // More permissive thresholds to detect partially-occluded hands near the face.
                minHandDetectionConfidence: 0.2,
                minHandPresenceConfidence: 0.2,
                minTrackingConfidence: 0.2,
              });
              handsInitStatus = 'ready';
              return hands as unknown as HandsLandmarkerInstance;
            } catch (handsErr) {
              lastHandsErr = handsErr;
            }
          }
        } catch (filesetErr) {
          lastHandsErr = filesetErr;
        }
      }

      console.warn(
        'MediaPipe HandsLandmarker init failed; continuing without hand heuristics:',
        lastHandsErr
      );
      handsInitStatus = 'unavailable';
      return null;
    })();
  }

  // Best-effort pose init (wrist near cheek fallback). Also does not fail face fallback.
  if (!poseLandmarkerPromise) {
    poseLandmarkerPromise = (async () => {
      let lastPoseErr: unknown = null;
      for (const wasmBaseUrl of wasmCandidates) {
        try {
          const filesetResolver = await vision.FilesetResolver.forVisionTasks(wasmBaseUrl);
          for (const poseModelAssetPath of poseModelCandidates) {
            try {
              const pose = await vision.PoseLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                  modelAssetPath: poseModelAssetPath,
                },
                runningMode: 'VIDEO',
                numPoses: 1,
                minPoseDetectionConfidence: 0.2,
                minPosePresenceConfidence: 0.2,
                minTrackingConfidence: 0.2,
              });
              poseInitStatus = 'ready';
              return pose as unknown as PoseLandmarkerInstance;
            } catch (poseErr) {
              lastPoseErr = poseErr;
            }
          }
        } catch (filesetErr) {
          lastPoseErr = filesetErr;
        }
      }

      console.warn(
        'MediaPipe PoseLandmarker init failed; continuing without pose heuristics:',
        lastPoseErr
      );
      poseInitStatus = 'unavailable';
      return null;
    })();
  }

  try {
    await faceLandmarkerPromise;
  } catch (err) {
    // Allow retry after a failed init.
    faceLandmarkerPromise = null;
    handsLandmarkerPromise = null;
    poseLandmarkerPromise = null;
    handsInitStatus = 'uninitialized';
    poseInitStatus = 'uninitialized';
    throw err;
  }
}

export async function detectEmotionWithMediaPipe(
  video: HTMLVideoElement,
  timestampMs: number
): Promise<MediaPipeEmotionResult | null> {
  if (!faceLandmarkerPromise) return null;

  if (detectInFlight) return null;
  detectInFlight = true;

  try {

    let landmarker: FaceLandmarkerInstance;
    try {
      landmarker = await faceLandmarkerPromise;
    } catch (err) {
      // Init failed earlier; allow caller to continue without crashing.
      console.warn('MediaPipe fallback not available:', err);
      return null;
    }

  const faceTimestamp = monotonicTimestampMs(timestampMs);
  let result: any;
  try {
    result = landmarker.detectForVideo(video, faceTimestamp);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Packet timestamp mismatch') || message.includes('CalculatorGraph::Run() failed')) {
      resetMediaPipeLandmarkers('timestamp mismatch in face detect', err);
      // Best-effort re-init so the next frame can recover without user action.
      try {
        await initMediaPipeEmotionFallback();
      } catch {
        // ignore; caller can keep running and it will retry later
      }
      return null;
    }
    throw err;
  }

  const landmarks = getFirstFaceLandmarks(result);

  let handLandmarksCount = 0;
  let poseLandmarksCount = 0;
  let minHandCheekDistanceRatio: number | undefined;
  let minPoseCheekDistanceRatio: number | undefined;

  let handInfo: HandProximityInfo | null = null;
  let handsAvailable = false;
  if (handsLandmarkerPromise) {
    try {
      const hands = await handsLandmarkerPromise;
      if (hands) {
        handsAvailable = true;
        const handsTimestamp = monotonicTimestampMs(timestampMs);
        const handsResult = hands.detectForVideo(video, handsTimestamp);
        const handLandmarks = getFirstHandLandmarks(handsResult);
        handLandmarksCount = handLandmarks?.length ?? 0;
        handInfo = computeHandOnCheekInfo(landmarks, handLandmarks);
        minHandCheekDistanceRatio = handInfo.minDistanceRatio ?? undefined;
      }
    } catch (err) {
      console.warn('MediaPipe hands detection failed; ignoring:', err);
    }
  }

  let wristInfo: WristProximityInfo | null = null;
  let poseAvailable = false;
  if (poseLandmarkerPromise) {
    try {
      const pose = await poseLandmarkerPromise;
      if (pose) {
        poseAvailable = true;
        const poseTimestamp = monotonicTimestampMs(timestampMs);
        const poseResult = pose.detectForVideo(video, poseTimestamp);
        const poseLandmarks = getFirstPoseLandmarks(poseResult);
        poseLandmarksCount = poseLandmarks?.length ?? 0;
        wristInfo = computeWristNearCheekInfo(landmarks, poseLandmarks);
        minPoseCheekDistanceRatio = wristInfo.minDistanceRatio ?? undefined;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Packet timestamp mismatch') || message.includes('CalculatorGraph::Run() failed')) {
        resetMediaPipeLandmarkers('timestamp mismatch in pose detect', err);
        try {
          await initMediaPipeEmotionFallback();
        } catch {
          // ignore
        }
        return null;
      }
      console.warn('MediaPipe pose detection failed; ignoring:', err);
    }
  }

  const scores = toBlendshapeScores(result);
  if (Object.keys(scores).length === 0) {
    // If landmarks exist but blendshapes are missing, we still consider the face detected.
    // Return a low-confidence Neutral so the UI can show activity.
    if (landmarks) {
      return { label: 'Neutral', confidence: 0.05 };
    }
    return null;
  }

  // Combine touch signals: prefer detailed hand landmarks, but fall back to pose wrist proximity.
  const handOnCheekScore = handInfo?.handOnCheekScore ?? 0;
  const wristNearCheekScore = wristInfo?.wristNearCheekScore ?? 0;
  const cheekTouchScore = Math.max(handOnCheekScore, wristNearCheekScore);

    const inferred = inferEmotionFromBlendshapes(scores, landmarks, {
      handDetected: (handInfo?.handDetected ?? false) || cheekTouchScore > 0,
      handOnCheekScore: cheekTouchScore,
      minDistanceRatio: handInfo?.minDistanceRatio ?? null,
    });
    inferred.debug = {
      ...(inferred.debug ?? {}),
      handsAvailable: handsAvailable || handsInitStatus === 'ready',
      poseAvailable: poseAvailable || poseInitStatus === 'ready',
      wristNearCheekScore,
      cheekTouchScore,
      handLandmarksCount,
      poseLandmarksCount,
      minHandCheekDistanceRatio,
      minPoseCheekDistanceRatio,
    };
    return inferred;
  } finally {
    detectInFlight = false;
  }
}
