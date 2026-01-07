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
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import {
  initMediaPipeEmotionFallback,
  detectEmotionWithMediaPipe,
} from './mediapipeEmotion';

// ====================================
// TYPE DEFINITIONS
// ====================================

interface EmotionCameraProps {
  userId: string; // User ID for logging
  materialId?: string; // Optional material ID for context
  onEmotionDetected?: (emotion: EmotionLabel, confidence: number) => void;
  autoLog?: boolean; // Auto-save to database (default: true)
  showVideo?: boolean; // Show webcam feed (default: false for privacy)
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
  className = '',
}: EmotionCameraProps) {
  // Zustand store
  const { isCamActive, toggleCamera, setEmotion, setModelLoaded, isModelLoaded } =
    useEmotionStore();

  // Refs
  const webcamRef = useRef<Webcam>(null);
  const modelRef = useRef<tf.GraphModel | tf.LayersModel | null>(null);
  const metadataRef = useRef<{ labels: string[] } | null>(null);
  const detectorModeRef = useRef<'tfjs' | 'mediapipe' | 'none'>('none');
  const animationFrameRef = useRef<number | null>(null);
  const lastLogTimeRef = useRef<number>(0);

  // Local state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    const modelURL = process.env.NEXT_PUBLIC_EMOTION_MODEL_URL || '/model/model.json';
    const metadataURL =
      process.env.NEXT_PUBLIC_EMOTION_METADATA_URL || '/model/metadata.json';
    return { modelURL, metadataURL };
  };

  const initMediaPipeFallback = useCallback(async () => {
    const wasmBaseUrl = process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_BASE_URL;
    const modelAssetPath = process.env.NEXT_PUBLIC_MEDIAPIPE_FACE_LANDMARKER_MODEL_URL;
    await initMediaPipeEmotionFallback({
      wasmBaseUrl: wasmBaseUrl || undefined,
      modelAssetPath: modelAssetPath || undefined,
    });
    detectorModeRef.current = 'mediapipe';
    setModelLoaded(true);
    console.log('✅ MediaPipe fallback initialized (blendshape-based)');
  }, [setModelLoaded]);

  const loadModel = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { modelURL, metadataURL } = resolveModelUrls();

      // Try GraphModel first (common for Teachable Machine + TFJS converter graph models)
      try {
        const graphModel = await tf.loadGraphModel(modelURL);
        modelRef.current = graphModel;
      } catch (graphErr) {
        // Then try LayersModel (common for custom MobileNetV2 transfer learning exports)
        const layersModel = await tf.loadLayersModel(modelURL);
        modelRef.current = layersModel;
        console.warn('ℹ️ Loaded as LayersModel (GraphModel load failed):', graphErr);
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

      if (!metadataRef.current?.labels || metadataRef.current.labels.length === 0) {
        throw new Error(
          'Emotion model loaded but labels are missing. Provide /model/metadata.json or NEXT_PUBLIC_EMOTION_LABELS.'
        );
      }

      detectorModeRef.current = 'tfjs';
      setModelLoaded(true);

      console.log('✅ Emotion model loaded successfully');
      console.log('📦 Model URL:', modelURL);
      console.log('📋 Labels:', metadataRef.current.labels);
    } catch (err) {
      console.error('❌ Error loading model:', err);

      // Fallback to MediaPipe so the feature still works.
      try {
        await initMediaPipeFallback();
        setError(
          'TFJS emotion model not found or failed to load. Using MediaPipe fallback (reduced accuracy).'
        );
      } catch (fallbackErr) {
        console.error('❌ MediaPipe fallback init failed:', fallbackErr);
        setError(
          'Failed to load emotion detection model and fallback. Please check model files and network access.'
        );
        setModelLoaded(false);
        detectorModeRef.current = 'none';
      }
    } finally {
      setIsLoading(false);
    }
  }, [setModelLoaded, initMediaPipeFallback]);

  // ====================================
  // EMOTION DETECTION LOOP
  // ====================================

  const detectEmotion = useCallback(async () => {
    if (!webcamRef.current || !isCamActive) {
      return;
    }

    try {
      const webcam = webcamRef.current.video;
      if (!webcam || webcam.readyState !== 4) {
        // Video not ready yet
        animationFrameRef.current = requestAnimationFrame(detectEmotion);
        return;
      }

      let emotionLabel: EmotionLabel | null = null;
      let confidence = 0;

      if (detectorModeRef.current === 'tfjs' && modelRef.current && metadataRef.current?.labels) {
        // Preprocess video frame for model
        const tensor = tf.tidy(() => {
          // Convert video to tensor
          const img = tf.browser.fromPixels(webcam);
          // Resize to model input size (typical 224x224 for MobileNetV2)
          const resized = tf.image.resizeBilinear(img, [224, 224]);
          // Normalize to [-1, 1]
          const normalized = resized.div(127.5).sub(1);
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
      } else if (detectorModeRef.current === 'mediapipe') {
        const mp = await detectEmotionWithMediaPipe(webcam, Date.now());
        if (mp) {
          emotionLabel = mp.label;
          confidence = mp.confidence;
        }
      }

      if (!emotionLabel) {
        // Continue loop
        setTimeout(() => {
          animationFrameRef.current = requestAnimationFrame(detectEmotion);
        }, 1000);
        return;
      }

      // Only update if confidence is above threshold
      // MediaPipe fallback uses heuristics; use slightly lower threshold.
      const threshold = detectorModeRef.current === 'mediapipe' ? 0.35 : 0.5;
      if (confidence > threshold) {
        const emotionData = {
          label: emotionLabel,
          confidence,
          timestamp: Date.now(),
        };

        // Update Zustand store
        setEmotion(emotionData);

        // Callback
        onEmotionDetected?.(emotionLabel, confidence);

        // Auto-log to database (every 5 seconds to reduce load)
        const now = Date.now();
        if (autoLog && now - lastLogTimeRef.current > 5000) {
          await logEmotionToDatabase(userId, materialId, emotionLabel, confidence);
          lastLogTimeRef.current = now;
        }
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
    }

    // Continue loop (run every ~1 second)
    setTimeout(() => {
      animationFrameRef.current = requestAnimationFrame(detectEmotion);
    }, 1000);
  }, [isCamActive, userId, materialId, autoLog, onEmotionDetected, setEmotion, initMediaPipeFallback]);

  // ====================================
  // LIFECYCLE
  // ====================================

  // Load model on mount
  useEffect(() => {
    if (!isModelLoaded) {
      loadModel();
    }
  }, [isModelLoaded, loadModel]);

  // Start/stop detection loop
  useEffect(() => {
    if (isCamActive && isModelLoaded) {
      detectEmotion();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCamActive, isModelLoaded, detectEmotion]);

  // ====================================
  // HANDLERS
  // ====================================

  const handleToggleCamera = () => {
    if (!isModelLoaded && !isCamActive) {
      setError('Model not loaded yet. Please wait...');
      return;
    }
    toggleCamera();
    setError(null);
  };

  // ====================================
  // RENDER
  // ====================================

  return (
    <div className={`emotion-camera-container ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={handleToggleCamera}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
          ${
            isCamActive
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        aria-label={isCamActive ? 'Turn off camera' : 'Turn on camera'}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading Model...
          </>
        ) : isCamActive ? (
          <>
            <CameraOff className="w-5 h-5" />
            Stop Camera
          </>
        ) : (
          <>
            <Camera className="w-5 h-5" />
            Start Camera
          </>
        )}
      </button>

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
            }}
            className="w-full h-auto"
          />

          {/* Privacy Indicator */}
          <div className="absolute top-2 right-2 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Recording
          </div>
        </div>
      )}

      {/* Status Info */}
      {isCamActive && !showVideo && (
        <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Camera active (hidden for privacy)
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
  const mapping: Record<string, EmotionLabel> = {
    neutral: 'Neutral',
    happy: 'Happy',
    anxious: 'Anxious',
    confused: 'Confused',
    frustrated: 'Frustrated',
    sad: 'Sad',
    surprised: 'Surprised',
    // Add more mappings based on your model
  };

  const normalized = className.toLowerCase().trim();
  return mapping[normalized] || 'Neutral';
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
