'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type SpeechStatus = 'idle' | 'playing' | 'paused' | 'error';

function stripToSpeakableText(input: string): string {
  // Keep this intentionally simple: remove common markdown noise and collapse whitespace.
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickIndonesianVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const idVoices = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('id'));
  if (idVoices.length > 0) return idVoices[0];

  // Fallback: any voice that mentions Indonesian.
  const byName = voices.find((v) => /indones/i.test(v.name));
  return byName;
}

export default function AudioReader({
  title,
  materialId,
  text,
}: {
  title?: string;
  materialId: string;
  text: string;
}) {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [isSupported, setIsSupported] = useState(true);
  const [rate, setRate] = useState(1);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  const [remoteScript, setRemoteScript] = useState<string | null>(null);
  const [isFetchingScript, setIsFetchingScript] = useState(false);

  const speakableText = useMemo(
    () => stripToSpeakableText(remoteScript ?? text),
    [remoteScript, text]
  );

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    setIsSupported(supported);

    if (!supported) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      // Stop any ongoing speech when leaving the page/component.
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    };
  }, []);

  const fetchScriptIfNeeded = async (): Promise<string> => {
    if (remoteScript) return remoteScript;

    setIsFetchingScript(true);
    try {
      const res = await fetch(`/api/student/material/${materialId}/audio-script`);
      if (!res.ok) throw new Error('Failed to fetch audio script');
      const json = (await res.json()) as { audioScript?: string };
      const script = typeof json.audioScript === 'string' ? json.audioScript : '';
      if (script.trim().length > 0) {
        setRemoteScript(script);
        return script;
      }
    } catch {
      // fall back to local text
    } finally {
      setIsFetchingScript(false);
    }

    return '';
  };

  const start = async () => {
    if (!isSupported) return;
    if (!stripToSpeakableText(text)) return;

    // On-demand: get cached/generated audio script once per material version.
    // If it fails, we still read the local text.
    const fetched = remoteScript ? remoteScript : await fetchScriptIfNeeded();
    const utterText = stripToSpeakableText((fetched && fetched.trim().length > 0) ? fetched : text);
    if (!utterText) return;

    try {
      // Cancel any queued speech first.
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(utterText);
      utter.rate = rate;

      const voice = pickIndonesianVoice(voicesRef.current);
      if (voice) utter.voice = voice;

      utter.onstart = () => setStatus('playing');
      utter.onend = () => setStatus('idle');
      utter.onerror = () => setStatus('error');
      utter.onpause = () => setStatus('paused');
      utter.onresume = () => setStatus('playing');

      utteranceRef.current = utter;
      window.speechSynthesis.speak(utter);
    } catch {
      setStatus('error');
    }
  };

  const pause = () => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.pause();
      setStatus('paused');
    } catch {
      setStatus('error');
    }
  };

  const resume = () => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.resume();
      setStatus('playing');
    } catch {
      setStatus('error');
    }
  };

  const stop = () => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.cancel();
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  const canPlay = isSupported && speakableText.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-gray-500">Audio Mode</div>
          <div className="font-semibold text-gray-900">{title ?? 'Read material'}</div>
        </div>
        <div className="text-xs text-gray-500">{status === 'playing' ? 'Playing...' : status === 'paused' ? 'Paused' : status === 'error' ? 'Error' : 'Ready'}</div>
      </div>

      {!isSupported && (
        <p className="mt-3 text-sm text-red-700">
          This browser does not support Text-to-Speech (Web Speech API).
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {status !== 'playing' && status !== 'paused' && (
          <button
            onClick={() => void start()}
            disabled={!canPlay}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFetchingScript ? 'Preparing...' : 'Play'}
          </button>
        )}

        {status === 'playing' && (
          <button
            onClick={pause}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-md text-sm"
          >
            Pause
          </button>
        )}

        {status === 'paused' && (
          <button
            onClick={resume}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
          >
            Resume
          </button>
        )}

        {(status === 'playing' || status === 'paused') && (
          <button
            onClick={stop}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 rounded-md text-sm"
          >
            Stop
          </button>
        )}

        <label className="ml-auto flex items-center gap-2 text-sm text-gray-700">
          <span className="text-gray-500">Speed</span>
          <select
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1 bg-white"
            disabled={!isSupported || status === 'playing'}
          >
            <option value={0.9}>0.9x</option>
            <option value={1}>1.0x</option>
            <option value={1.1}>1.1x</option>
            <option value={1.2}>1.2x</option>
          </select>
        </label>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Audio reads the same material text (saves prompt quota).
      </p>
    </div>
  );
}
