/**
 * EmotionCamera Component
 * 
 * This component uses the device webcam and TensorFlow.js (via Teachable Machine)
 * to detect student emotions in real-time.
 * 
 * Features:
 * - Real-time face detection
 * - Emotion classification (7 emotions)
 * - Confidence scoring
 * - Auto-logging to database
 * - Privacy controls (on/off toggle)
 * 
 * Flow:
 * 1. Request webcam permission
 * 2. Load pre-trained model from /public/model/
 * 3. Capture frame every 1 second
 * 4. Run inference
 * 5. Update Zustand store
 * 6. Log to database (every 5 seconds to reduce load)
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import { useEmotionStore } from '@/lib/store';
import type { EmotionLabel } from '@/lib/store';
import { Loader2 } from 'lucide-react';
import {
  initMediaPipeEmotionFallback,
  detectEmotionWithMediaPipe,
} from './mediapipeEmotion';

type DetectorPreference = 'tfjs' | 'mediapipe';

const DETECTOR_PREFERENCE_STORAGE_KEY = 'emotion-detector-preference';

// ====================================
// TYPE DEFINITIONS
// ====================================

interface EmotionCameraProps {
  userId: string; // User ID for logging
  materialId?: string; // Optional material ID for context
  onEmotionDetected?: (emotion: EmotionLabel, confidence: number) => void;
  autoLog?: boolean; // Auto-save to database (default: true)
  showVideo?: boolean; // Show webcam feed (default: false for privacy)
  autoStart?: boolean; // Start camera automatically when ready (default: false)
  className?: string;
}

// ====================================
// COMPONENT
// ====================================

export default function EmotionCamera({
  userId,
  materialId,
  onEmotionDetected,
  autoLog = true,
  showVideo = false,
  autoStart = true,
  className = '',
}: EmotionCameraProps) {
  // Zustand store
  const { isCamActive, toggleCamera, setEmotion, setModelLoaded, isModelLoaded } = useEmotionStore();
  const currentEmotion = useEmotionStore((state) => state.currentEmotion);

  // Refs
  const webcamRef = useRef<Webcam>(null);
  const modelRef = useRef<tf.GraphModel | tf.LayersModel | null>(null);
  const metadataRef = useRef<{ labels: string[]; inputSize?: [number, number] | number[] } | null>(
    null
  );
  const detectorModeRef = useRef<'tfjs' | 'mediapipe' | 'none'>('none');
  const animationFrameRef = useRef<number | null>(null);
  const lastLogTimeRef = useRef<number>(0);
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopTokenRef = useRef<number>(0);
  const detectionInProgressRef = useRef<boolean>(false);

  // Local state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string | null>(null);
  const [selectedVideoDeviceLabel, setSelectedVideoDeviceLabel] = useState<string | null>(null);
  const [detectorMode, setDetectorMode] = useState<'tfjs' | 'mediapipe' | 'none'>('none');
  const [lastFaceDetectedAt, setLastFaceDetectedAt] = useState<number | null>(null);
  const [isNegativeInferred, setIsNegativeInferred] = useState(false);
  const [mediapipeHandOnCheekScore, setMediapipeHandOnCheekScore] = useState<number | null>(null);
  const [mediapipeHandDetected, setMediapipeHandDetected] = useState<boolean | null>(null);
  const [mediapipeHandsAvailable, setMediapipeHandsAvailable] = useState<boolean | null>(null);
  const [mediapipePoseAvailable, setMediapipePoseAvailable] = useState<boolean | null>(null);
  const [mediapipeWristNearCheekScore, setMediapipeWristNearCheekScore] = useState<number | null>(null);
  const [mediapipeHandLandmarksCount, setMediapipeHandLandmarksCount] = useState<number | null>(null);
  const [mediapipePoseLandmarksCount, setMediapipePoseLandmarksCount] = useState<number | null>(null);
  const [mediapipeMinHandCheekRatio, setMediapipeMinHandCheekRatio] = useState<number | null>(null);
  const [mediapipeMinPoseCheekRatio, setMediapipeMinPoseCheekRatio] = useState<number | null>(null);
  const [detectorPreference, setDetectorPreference] = useState<DetectorPreference>(() => {
    if (typeof window === 'undefined') return 'tfjs';
    const raw = window.localStorage.getItem(DETECTOR_PREFERENCE_STORAGE_KEY);
    return raw === 'mediapipe' ? 'mediapipe' : 'tfjs';
  });

  // ====================================
  // MODEL LOADING
  // ====================================

  const getConfiguredLabels = (): string[] | null => {
    const raw = process.env.NEXT_PUBLIC_EMOTION_LABELS;
    if (!raw) return null;
    const labels = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return labels.length > 0 ? labels : null;
  };

  const resolveModelUrls = () => {
    // Default to the TFJS model folder shipped in this repo.
    // You can override via NEXT_PUBLIC_EMOTION_MODEL_URL / NEXT_PUBLIC_EMOTION_METADATA_URL.
    const modelURL =
      process.env.NEXT_PUBLIC_EMOTION_MODEL_URL ||
      '/model/tfjs_model/model.json';
    const metadataURL =
      process.env.NEXT_PUBLIC_EMOTION_METADATA_URL ||
      '/model/tfjs_model/metadata.json';
    return { modelURL, metadataURL };
  };

  const resolveModelInputSize = (): [number, number] => {
    const fromMetadata = metadataRef.current?.inputSize;
    if (Array.isArray(fromMetadata) && fromMetadata.length >= 2) {
      const h = Number(fromMetadata[0]);
      const w = Number(fromMetadata[1]);
      if (Number.isFinite(h) && Number.isFinite(w) && h > 0 && w > 0) {
        return [h, w];
      }
    }

    // Try to infer from the loaded model signature.
    const model: any = modelRef.current as any;
    const shape: any[] | undefined = model?.inputs?.[0]?.shape;
    if (Array.isArray(shape) && shape.length >= 4) {
      const h = Number(shape[1]);
      const w = Number(shape[2]);
      if (Number.isFinite(h) && Number.isFinite(w) && h > 0 && w > 0) {
        return [h, w];
      }
    }

    // Default for the shipped CNN model.
    return [48, 48];
  };

  const initMediaPipeFallback = useCallback(async () => {
    const wasmBaseUrl = process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_BASE_URL;
    const modelAssetPath = process.env.NEXT_PUBLIC_MEDIAPIPE_FACE_LANDMARKER_MODEL_URL;
    const handsModelAssetPath = process.env.NEXT_PUBLIC_MEDIAPIPE_HAND_LANDMARKER_MODEL_URL;
    const poseModelAssetPath = process.env.NEXT_PUBLIC_MEDIAPIPE_POSE_LANDMARKER_MODEL_URL;
    try {
      await initMediaPipeEmotionFallback({
        wasmBaseUrl: wasmBaseUrl || undefined,
        modelAssetPath: modelAssetPath || undefined,
        handsModelAssetPath: handsModelAssetPath || undefined,
        poseModelAssetPath: poseModelAssetPath || undefined,
      });
      detectorModeRef.current = 'mediapipe';
      setDetectorMode('mediapipe');
      setModelLoaded(true);
      console.log('✅ MediaPipe fallback initialized (blendshape-based)');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown MediaPipe init error';
      console.error('❌ MediaPipe fallback init failed:', err);
      setError(msg);
      setModelLoaded(false);
      detectorModeRef.current = 'none';
      setDetectorMode('none');
      throw err;
    }
  }, [setModelLoaded]);

  const loadModel = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { modelURL, metadataURL } = resolveModelUrls();

      // Ensure TFJS has a working backend/runtime in the browser.
      // Some environments start in an unusable backend (or WebGL is blocked).
      try {
        await tf.setBackend('webgl');
      } catch {
        // Ignore; we'll fall back to CPU below.
      }

      try {
        await tf.ready();
        const backend = tf.getBackend();
        if (!backend) {
          await tf.setBackend('cpu');
          await tf.ready();
        }
      } catch {
        // Last-resort backend
        await tf.setBackend('cpu');
        await tf.ready();
      }

      // Detect model format so we don't accidentally try the wrong loader.
      // Trying to load a layers-model with loadGraphModel can throw confusing errors
      // like: "Cannot read properties of undefined (reading 'producer')".
      let detectedFormat: string | null = null;
      try {
        const res = await fetch(modelURL, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          const fmt = typeof json?.format === 'string' ? String(json.format) : null;
          detectedFormat = fmt;
        }
      } catch {
        // Ignore and fall back to heuristic loader attempts below.
      }

      if (detectedFormat === 'layers-model') {
        modelRef.current = await tf.loadLayersModel(modelURL);
      } else if (detectedFormat === 'graph-model') {
        modelRef.current = await tf.loadGraphModel(modelURL);
      } else {
        // Unknown format: try both loaders and surface the real errors.
        let layersErr: unknown = null;
        try {
          modelRef.current = await tf.loadLayersModel(modelURL);
        } catch (err) {
          layersErr = err;
        }

        if (!modelRef.current) {
          try {
            modelRef.current = await tf.loadGraphModel(modelURL);
          } catch (graphErr) {
            const layersMsg =
              layersErr instanceof Error ? layersErr.message : String(layersErr);
            const graphMsg =
              graphErr instanceof Error ? graphErr.message : String(graphErr);
            throw new Error(
              `Failed to load TFJS model. ` +
                `Detected format: ${detectedFormat ?? 'unknown'}. ` +
                `LayersModel error: ${layersMsg}. ` +
                `GraphModel error: ${graphMsg}.`
            );
          }
        }
      }

      // Try metadata.json, otherwise fall back to env labels.
      try {
        const metadataResponse = await fetch(metadataURL);
        if (!metadataResponse.ok) throw new Error(`metadata fetch failed: ${metadataResponse.status}`);
        const metadata = await metadataResponse.json();
        if (metadata?.labels && Array.isArray(metadata.labels)) {
          metadataRef.current = metadata;
        } else {
          metadataRef.current = null;
        }
      } catch {
        metadataRef.current = null;
      }

      if (!metadataRef.current) {
        const labels = getConfiguredLabels();
        if (labels) {
          metadataRef.current = { labels };
        }
      }

      // Final fallback: 3-class canonical labels.
      if (!metadataRef.current) {
        metadataRef.current = { labels: ['Negative', 'Neutral', 'Positive'] };
      }

      if (!metadataRef.current?.labels || metadataRef.current.labels.length === 0) {
        throw new Error(
          'Emotion model loaded but labels are missing. Provide /model/metadata.json or NEXT_PUBLIC_EMOTION_LABELS.'
        );
      }

      detectorModeRef.current = 'tfjs';
      setDetectorMode('tfjs');
      setModelLoaded(true);

      console.log('✅ Emotion model loaded successfully');
      console.log('📦 Model URL:', modelURL);
      console.log('📋 Labels:', metadataRef.current.labels);
      console.log('🧠 TFJS Backend:', tf.getBackend());
    } catch (err) {
      console.error('❌ Error loading model:', err);

      const { modelURL, metadataURL } = resolveModelUrls();
      const errMsg = err instanceof Error ? err.message : String(err);

      // Fallback to MediaPipe so the feature still works.
      try {
        await initMediaPipeFallback();
        setError(
          `TFJS emotion model failed to load (${errMsg}). Using MediaPipe fallback (reduced accuracy). ` +
            `Model URL: ${modelURL} | Metadata URL: ${metadataURL}`
        );
      } catch (fallbackErr) {
        console.error('❌ MediaPipe fallback init failed:', fallbackErr);
        setError(
          'Failed to load emotion detection model and fallback. Please check model files and network access.'
        );
        setModelLoaded(false);
        detectorModeRef.current = 'none';
        setDetectorMode('none');
      }
    } finally {
      setIsLoading(false);
    }
  }, [setModelLoaded, initMediaPipeFallback]);

  const applyDetectorPreference = useCallback(
    async (preference: DetectorPreference) => {
      setError(null);

      if (preference === 'mediapipe') {
        await initMediaPipeFallback();
        return;
      }

      // preference === 'tfjs'
      // If model is already loaded, just switch mode.
      if (modelRef.current && metadataRef.current?.labels?.length) {
        detectorModeRef.current = 'tfjs';
        setDetectorMode('tfjs');
        setModelLoaded(true);
        return;
      }

      // Otherwise load the TFJS model (it already falls back to MediaPipe if loading fails).
      await loadModel();
    },
    [initMediaPipeFallback, loadModel, setModelLoaded]
  );

  // ====================================
  // EMOTION DETECTION LOOP
  // ====================================

  const detectEmotion = useCallback(
    async (loopToken: number) => {
      if (loopTokenRef.current !== loopToken) return;
      if (!webcamRef.current || !isCamActive) {
        return;
      }

      // Prevent overlapping inference calls (can happen if multiple loops were started).
      if (detectionInProgressRef.current) {
        return;
      }
      detectionInProgressRef.current = true;

      const scheduleNext = () => {
        if (loopTokenRef.current !== loopToken) return;
        if (loopTimeoutRef.current) {
          clearTimeout(loopTimeoutRef.current);
        }
        loopTimeoutRef.current = setTimeout(() => {
          if (loopTokenRef.current !== loopToken) return;
          animationFrameRef.current = requestAnimationFrame(() => {
            void detectEmotion(loopToken);
          });
        }, 1000);
      };

    try {
        const webcam = webcamRef.current.video;
        if (!webcam || webcam.readyState !== 4 || webcam.videoWidth === 0 || webcam.videoHeight === 0) {
          // Video not ready yet
          animationFrameRef.current = requestAnimationFrame(() => {
            void detectEmotion(loopToken);
          });
          return;
        }

      let emotionLabel: EmotionLabel | null = null;
      let confidence = 0;

      if (detectorModeRef.current === 'tfjs' && modelRef.current && metadataRef.current?.labels) {
        // Preprocess video frame for model
        const [inputH, inputW] = resolveModelInputSize();
        const tensor = tf.tidy(() => {
          // Convert video to tensor
          const img = tf.browser.fromPixels(webcam);
          // Resize to model input size (this repo's CNN uses 48x48)
          const resized = tf.image.resizeBilinear(img, [inputH, inputW]);
          // Normalize to [0, 1] (training used rescale=1./255)
          const normalized = resized.toFloat().div(255);
          // Add batch dimension
          return normalized.expandDims(0);
        });

        // Run prediction (GraphModel or LayersModel)
        let output: tf.Tensor | tf.Tensor[];
        try {
          output = (modelRef.current as any).predict(tensor);
        } catch (predictErr) {
          tensor.dispose();
          throw predictErr;
        }

        const logitsTensor = Array.isArray(output) ? output[0] : output;
        const probabilities = await logitsTensor.data();

        tensor.dispose();
        if (Array.isArray(output)) {
          for (const t of output) t.dispose();
        } else {
          output.dispose();
        }

        const probsArray = Array.from(probabilities);
        const maxIndex = probsArray.indexOf(Math.max(...probsArray));
        confidence = probsArray[maxIndex] ?? 0;
        const className = metadataRef.current.labels[maxIndex] ?? 'neutral';
        emotionLabel = mapClassNameToEmotion(className);
        setIsNegativeInferred(false);
        setMediapipeHandOnCheekScore(null);
        setMediapipeHandDetected(null);
        setMediapipeHandsAvailable(null);
        setMediapipePoseAvailable(null);
        setMediapipeWristNearCheekScore(null);
        setMediapipeHandLandmarksCount(null);
        setMediapipePoseLandmarksCount(null);
        setMediapipeMinHandCheekRatio(null);
        setMediapipeMinPoseCheekRatio(null);
      } else if (detectorModeRef.current === 'mediapipe') {
        // MediaPipe Tasks converts timestampMs internally; using large epoch timestamps
        // (Date.now) can lose microsecond precision and trigger "Packet timestamp mismatch".
        // Use a small, monotonic clock relative to page start instead.
        const mpNowMs =
          typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
        const mp = await detectEmotionWithMediaPipe(webcam, mpNowMs);
        if (mp) {
          // Base (face) emotion output.
          const baseLabel: EmotionLabel = mp.label;
          const baseConfidence = mp.confidence;

          const handDetected = mp.debug?.handDetected ?? false;
          const handOnCheekScore = mp.debug?.handOnCheekScore ?? 0;
          const handsAvailable = mp.debug?.handsAvailable ?? null;
          const poseAvailable = mp.debug?.poseAvailable ?? null;
          const wristNearCheekScore = mp.debug?.wristNearCheekScore ?? null;
          const handLandmarksCount = mp.debug?.handLandmarksCount ?? null;
          const poseLandmarksCount = mp.debug?.poseLandmarksCount ?? null;
          const minHandCheekRatio = mp.debug?.minHandCheekDistanceRatio ?? null;
          const minPoseCheekRatio = mp.debug?.minPoseCheekDistanceRatio ?? null;
          setMediapipeHandDetected(handDetected);
          setMediapipeHandOnCheekScore(handOnCheekScore);
          setMediapipeHandsAvailable(handsAvailable);
          setMediapipePoseAvailable(poseAvailable);
          setMediapipeWristNearCheekScore(wristNearCheekScore);
          setMediapipeHandLandmarksCount(handLandmarksCount);
          setMediapipePoseLandmarksCount(poseLandmarksCount);
          setMediapipeMinHandCheekRatio(minHandCheekRatio);
          setMediapipeMinPoseCheekRatio(minPoseCheekRatio);

          // Rule-based inference layer (academically safer):
          // - Keep face emotion as base.
          // - If hand on cheek AND not smiling strongly -> infer Negative.
          const strongPositive = baseLabel === 'Positive' && baseConfidence >= 0.7;
          const handCloseByRatio =
            typeof minHandCheekRatio === 'number' ? minHandCheekRatio <= 0.30 : false;
          const poseCloseByRatio =
            typeof minPoseCheekRatio === 'number' ? minPoseCheekRatio <= 0.55 : false;

          const handOnCheek =
            handDetected &&
            (handOnCheekScore >= 0.25 || handCloseByRatio || poseCloseByRatio);

          if (!strongPositive && handOnCheek) {
            emotionLabel = 'Negative';
            // Confidence for inferred class: combine contextual score and base confidence.
            confidence = Math.max(0.35, Math.min(1, Math.max(handOnCheekScore, baseConfidence)));
            setIsNegativeInferred(true);
          } else {
            emotionLabel = baseLabel;
            confidence = baseConfidence;
            setIsNegativeInferred(false);
          }

          setLastFaceDetectedAt(Date.now());
        }
      }

        if (!emotionLabel) {
          scheduleNext();
          return;
        }

      // Always update UI state so the user can see class + confidence,
      // even when confidence is low (important for research UX).
      const emotionData = {
        label: emotionLabel,
        confidence,
        timestamp: Date.now(),
      };

      setEmotion(emotionData);
      onEmotionDetected?.(emotionLabel, confidence);

      // Only auto-log when confidence is above threshold (reduce noisy logs).
      const threshold = detectorModeRef.current === 'mediapipe' ? 0.2 : 0.35;
      const now = Date.now();
      if (autoLog && confidence > threshold && now - lastLogTimeRef.current > 5000) {
        await logEmotionToDatabase(userId, materialId, emotionLabel, confidence);
        lastLogTimeRef.current = now;
      }
      } catch (err) {
        console.error('Error detecting emotion:', err);

        // If TFJS inference fails at runtime, switch to MediaPipe fallback.
        if (detectorModeRef.current === 'tfjs') {
          try {
            await initMediaPipeFallback();
            setError('TFJS emotion inference failed. Switched to MediaPipe fallback.');
          } catch {
            // keep silent; loop continues
          }
        }
      } finally {
        detectionInProgressRef.current = false;
      }

      // Continue loop (run every ~1 second)
      scheduleNext();
    },
    [isCamActive, userId, materialId, autoLog, onEmotionDetected, setEmotion, initMediaPipeFallback]
  );

  // ====================================
  // LIFECYCLE
  // ====================================

  const pickPreferredVideoInput = async (): Promise<MediaDeviceInfo | null> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return null;
    }

    let devices = await navigator.mediaDevices.enumerateDevices();

    // Labels are often empty until permission is granted.
    if (devices.every((d) => !d.label)) {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        tempStream.getTracks().forEach((t) => t.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch {
        // ignore; we'll fall back to default device selection
      }
    }

    const videoInputs = devices.filter((d) => d.kind === 'videoinput');
    if (videoInputs.length === 0) return null;

    const preferRe = /(integrated|built-?in|internal)/i;
    const avoidRe = /(phone|continuity|droidcam|ivcam|epoccam|virtual|obs|snap|link)/i;

    const preferred = videoInputs.find((d) => preferRe.test(d.label) && !avoidRe.test(d.label));
    if (preferred) return preferred;

    const nonAvoid = videoInputs.find((d) => !avoidRe.test(d.label));
    return nonAvoid || videoInputs[0];
  };

  // Pick a stable camera device when camera is enabled.
  useEffect(() => {
    if (!isCamActive) {
      setSelectedVideoDeviceId(null);
      setSelectedVideoDeviceLabel(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const device = await pickPreferredVideoInput();
        if (cancelled) return;
        setSelectedVideoDeviceId(device?.deviceId || null);
        setSelectedVideoDeviceLabel(device?.label || null);
      } catch {
        // Keep default selection if anything fails
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isCamActive]);

  // Load model on mount
  useEffect(() => {
    if (isModelLoaded) return;
    applyDetectorPreference(detectorPreference);
  }, [isModelLoaded, detectorPreference, applyDetectorPreference]);

  // Persist user preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(DETECTOR_PREFERENCE_STORAGE_KEY, detectorPreference);
    } catch {
      // ignore storage errors
    }
  }, [detectorPreference]);

  // Stream MediaPipe diagnostics to browser console (keep UI clean).
  const mpConsoleLastLogAtRef = useRef<number>(0);
  useEffect(() => {
    if (detectorMode !== 'mediapipe') return;

    const now = Date.now();
    // Throttle to avoid spamming the console too hard.
    if (now - mpConsoleLastLogAtRef.current < 500) return;
    mpConsoleLastLogAtRef.current = now;

    const faceDetected = !!(lastFaceDetectedAt && now - lastFaceDetectedAt < 5000);

    const handLine =
      mediapipeHandsAvailable === false
        ? 'unavailable'
        : mediapipeHandDetected == null
          ? '—'
          : mediapipeHandDetected
            ? `detected (cheek=${Math.round((mediapipeHandOnCheekScore ?? 0) * 100)}%)`
            : `not detected (pose=${mediapipePoseAvailable === false ? 'off' : 'on'} wrist=${Math.round((mediapipeWristNearCheekScore ?? 0) * 100)}%)`;

    const debugParts: string[] = [];
    debugParts.push(`handsPts=${mediapipeHandLandmarksCount ?? '—'}`);
    debugParts.push(`posePts=${mediapipePoseLandmarksCount ?? '—'}`);
    if (typeof mediapipeMinHandCheekRatio === 'number') {
      debugParts.push(`handRatio=${mediapipeMinHandCheekRatio.toFixed(3)}`);
    }
    if (typeof mediapipeMinPoseCheekRatio === 'number') {
      debugParts.push(`poseRatio=${mediapipeMinPoseCheekRatio.toFixed(3)}`);
    }

    // Use console.log so it shows up even when "Verbose" logs are hidden.
    console.log(
      `[MediaPipe] Face: ${faceDetected ? 'detected' : 'not detected'} | Hand: ${handLine} | Debug: ${debugParts.join(' ')}`
    );
  }, [
    detectorMode,
    lastFaceDetectedAt,
    mediapipeHandDetected,
    mediapipeHandOnCheekScore,
    mediapipeHandsAvailable,
    mediapipePoseAvailable,
    mediapipeWristNearCheekScore,
    mediapipeHandLandmarksCount,
    mediapipePoseLandmarksCount,
    mediapipeMinHandCheekRatio,
    mediapipeMinPoseCheekRatio,
    currentEmotion,
    isNegativeInferred,
  ]);

  // Auto-start camera once model is ready.
  useEffect(() => {
    if (!autoStart) return;
    if (!isModelLoaded) return;
    if (isCamActive) return;
    toggleCamera();
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, isModelLoaded, isCamActive]);

  // Start/stop detection loop
  useEffect(() => {
    if (isCamActive && isModelLoaded) {
      // Cancel any previous loop and start a fresh one.
      loopTokenRef.current += 1;
      const token = loopTokenRef.current;
      void detectEmotion(token);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }

      // Invalidate any scheduled callbacks.
      loopTokenRef.current += 1;
      detectionInProgressRef.current = false;
    };
  }, [isCamActive, isModelLoaded, detectEmotion]);

  // ====================================
  // RENDER
  // ====================================

  return (
    <div className={`emotion-camera-container ${className}`}>
      {/* Model toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-gray-800">Model</div>
        <div className="inline-flex rounded-lg border bg-white p-1">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setDetectorPreference('tfjs');
              applyDetectorPreference('tfjs');
            }}
            className={
              'px-3 py-1 text-xs font-medium rounded-md transition-colors ' +
              (detectorPreference === 'tfjs'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100') +
              (isLoading ? ' opacity-60 cursor-not-allowed' : '')
            }
            aria-pressed={detectorPreference === 'tfjs'}
            title="Pakai model utama (TFJS)"
          >
            Model Saya (TFJS)
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setDetectorPreference('mediapipe');
              applyDetectorPreference('mediapipe');
            }}
            className={
              'px-3 py-1 text-xs font-medium rounded-md transition-colors ' +
              (detectorPreference === 'mediapipe'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100') +
              (isLoading ? ' opacity-60 cursor-not-allowed' : '')
            }
            aria-pressed={detectorPreference === 'mediapipe'}
            title="Pakai fallback MediaPipe (lebih ringan, heuristic)"
          >
            Fallback (MediaPipe)
          </button>
        </div>
      </div>

      <div className="mt-1 text-xs text-gray-500">
        Aktif: <span className="font-medium text-gray-700">{detectorMode}</span>
      </div>

      {/* Camera is mandatory; no start/stop controls */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading emotion model…
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Webcam Feed (Hidden by default for privacy) */}
      {isCamActive && (
        <div
          className={`mt-4 ${
            showVideo ? 'block' : 'hidden'
          } relative rounded-lg overflow-hidden`}
        >
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              width: 640,
              height: 480,
              facingMode: 'user',
              ...(selectedVideoDeviceId
                ? { deviceId: { exact: selectedVideoDeviceId } }
                : null),
            }}
            key={selectedVideoDeviceId || 'default-camera'}
            onUserMediaError={(err) => {
              console.error('Webcam permission / device error:', err);
              setError('Failed to access camera. Please check browser permission and camera device.');
            }}
            className="w-full h-auto"
          />

          {/* Privacy Indicator */}
          <div className="absolute top-2 right-2 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Recording
          </div>

          {/* Detection Status Overlay */}
          <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm text-gray-900 px-3 py-2 rounded-lg text-xs border">
            <div className="font-semibold">Detection</div>
            <div className="mt-0.5 text-gray-700">Mode: {detectorMode}</div>
            <div className="mt-0.5">
                Class:{' '}
                {currentEmotion
                  ? currentEmotion.label === 'Negative' && isNegativeInferred
                    ? 'Negative (inferred)'
                    : currentEmotion.label
                  : '—'}
            </div>
            <div>
              Confidence:{' '}
              {currentEmotion ? `${Math.round(currentEmotion.confidence * 100)}%` : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Status Info */}
      {isCamActive && !showVideo && (
        <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Camera active (hidden for privacy)
          {selectedVideoDeviceLabel ? `- ${selectedVideoDeviceLabel}` : ''}
        </div>
      )}
    </div>
  );
}

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Map Teachable Machine class names to EmotionLabel
 * Adjust based on your model's output classes
 */
function mapClassNameToEmotion(className: string): EmotionLabel {
  const normalized = className.toLowerCase().trim();

  // Canonical 3-class model
  if (normalized === 'positive') return 'Positive';
  if (normalized === 'neutral') return 'Neutral';
  if (normalized === 'negative') return 'Negative';

  // Legacy/heuristic labels -> canonical
  if (normalized === 'happy') return 'Positive';
  if (
    normalized === 'anxious' ||
    normalized === 'confused' ||
    normalized === 'frustrated' ||
    normalized === 'sad' ||
    normalized === 'angry' ||
    normalized === 'fearful' ||
    normalized === 'disgusted'
  ) {
    return 'Negative';
  }
  if (normalized === 'surprised') return 'Neutral';

  return 'Neutral';
}

/**
 * Log emotion to database via API
 */
async function logEmotionToDatabase(
  userId: string,
  materialId: string | undefined,
  emotionLabel: EmotionLabel,
  confidence: number
): Promise<void> {
  try {
    await fetch('/api/student/log-emotion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        materialId,
        emotionLabel,
        confidence,
      }),
    });
  } catch (error) {
    console.error('Failed to log emotion:', error);
    // Fail silently to not disrupt user experience
  }
}
