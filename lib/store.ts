/**
 * Zustand Global State Store
 * 
 * This store manages the real-time emotion detection state across the application.
 * It's used to share emotion data between the camera component and adaptive UI components.
 * 
 * Key Features:
 * - Tracks current detected emotion
 * - Tracks emotion confidence level
 * - Manages camera active state
 * - Stores user session info
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ====================================
// TYPE DEFINITIONS
// ====================================

export type EmotionLabel =
  | 'Negative'
  | 'Neutral'
  | 'Positive';

export interface EmotionData {
  label: EmotionLabel;
  confidence: number; // 0.0 - 1.0
  timestamp: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'TEACHER';
  learningStyle?: 'VISUAL' | 'AUDITORY' | 'KINESTHETIC';
}

// ====================================
// STORE INTERFACE
// ====================================

interface EmotionStore {
  // Emotion State
  currentEmotion: EmotionData | null;
  emotionHistory: EmotionData[]; // Keep last 10 detections for trend analysis
  
  // Camera State
  isCamActive: boolean;
  isModelLoaded: boolean;
  
  // User State
  user: User | null;

  // Hydration State
  hasHydrated: boolean;
  
  // Actions - Emotion
  setEmotion: (emotion: EmotionData) => void;
  clearEmotion: () => void;
  
  // Actions - Camera
  toggleCamera: () => void;
  setModelLoaded: (loaded: boolean) => void;
  
  // Actions - User
  setUser: (user: User | null) => void;

  // Actions - Hydration
  setHasHydrated: (hasHydrated: boolean) => void;
  
  // Utility
  getEmotionTrend: () => EmotionLabel | null; // Get most frequent emotion in history
}

// ====================================
// STORE IMPLEMENTATION
// ====================================

export const useEmotionStore = create<EmotionStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        currentEmotion: null,
        emotionHistory: [],
        isCamActive: false,
        isModelLoaded: false,
        user: null,
        hasHydrated: false,

        // Set new emotion and update history
        setEmotion: (emotion: EmotionData) =>
          set((state) => {
            // Keep only last 10 emotions for trend analysis
            const newHistory = [emotion, ...state.emotionHistory].slice(0, 10);
            
            return {
              currentEmotion: emotion,
              emotionHistory: newHistory,
            };
          }),

        // Clear current emotion (e.g., when camera is turned off)
        clearEmotion: () =>
          set({
            currentEmotion: null,
          }),

        // Toggle camera on/off
        toggleCamera: () =>
          set((state) => ({
            isCamActive: !state.isCamActive,
            // Clear emotion when turning off camera
            currentEmotion: state.isCamActive ? null : state.currentEmotion,
          })),

        // Set model loaded status
        setModelLoaded: (loaded: boolean) =>
          set({
            isModelLoaded: loaded,
          }),

        // Set user data
        setUser: (user: User | null) =>
          set({
            user,
          }),

        setHasHydrated: (hasHydrated: boolean) =>
          set({
            hasHydrated,
          }),

        // Get emotion trend from history (most frequent emotion)
        getEmotionTrend: () => {
          const history = get().emotionHistory;
          
          if (history.length === 0) return null;

          // Count occurrences of each emotion
          const emotionCounts = history.reduce((acc, emotion) => {
            acc[emotion.label] = (acc[emotion.label] || 0) + 1;
            return acc;
          }, {} as Record<EmotionLabel, number>);

          // Find most frequent emotion
          const mostFrequent = Object.entries(emotionCounts).reduce((a, b) =>
            a[1] > b[1] ? a : b
          );

          return mostFrequent[0] as EmotionLabel;
        },
      }),
      {
        name: 'emotion-store', // Persist key in localStorage
        version: 2,
        partialize: (state) => ({
          // Only persist user data, not emotion/camera state
          user: state.user,
        }),
        migrate: (persistedState, version) => {
          // Older versions of this app may have persisted emotion state with legacy
          // 7-class labels (e.g. "Happy"). We never want to rehydrate those.
          // Keep only the user slice.
          if (!persistedState || typeof persistedState !== 'object') {
            return { user: null } as any;
          }

          const state = persistedState as any;

          // If an old version stored more fields, drop them.
          if (version < 2) {
            return { user: state.user ?? null } as any;
          }

          return { user: state.user ?? null } as any;
        },
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true);
        },
      }
    ),
    {
      name: 'EmotionStore', // Name for Redux DevTools
    }
  )
);

// ====================================
// SELECTOR HOOKS (Optimized re-renders)
// ====================================

// Hook to get only current emotion (prevents unnecessary re-renders)
export const useCurrentEmotion = () =>
  useEmotionStore((state) => state.currentEmotion);

// Hook to get camera active state
export const useCameraActive = () =>
  useEmotionStore((state) => state.isCamActive);

// Hook to get user data
export const useUser = () => useEmotionStore((state) => state.user);

// Hook to check when persisted state has loaded
export const useHasHydrated = () => useEmotionStore((state) => state.hasHydrated);

// Hook to check if student is experiencing anxiety (for adaptive UI)
export const useIsAnxious = () =>
  useEmotionStore(
    (state) =>
      state.currentEmotion?.label === 'Negative' &&
      state.currentEmotion?.confidence > 0.6
  );
