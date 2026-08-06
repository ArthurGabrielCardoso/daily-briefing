import { useEffect, useState } from 'react';
import { useSpeech, type UseSpeechResult } from './useSpeech';
import { useAudioNarration, type AudioManifest } from './useAudioNarration';

const EMPTY_MANIFEST: AudioManifest = {
  date: '1970-01-01',
  voice: '',
  generatedAt: '',
  totalChars: 0,
  totalDuration: 0,
  blocks: [],
};

/** Fetches the narration manifest for an edition, or null when none was rendered. */
export function useAudioManifest(date: string | null): {
  manifest: AudioManifest | null;
  settled: boolean;
} {
  const [manifest, setManifest] = useState<AudioManifest | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setManifest(null);
    setSettled(false);

    fetch(`/api/briefings/${date}/audio`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: AudioManifest | null) => {
        if (cancelled) return;
        setManifest(json && Array.isArray(json.blocks) && json.blocks.length ? json : null);
        setSettled(true);
      })
      .catch(() => {
        if (!cancelled) setSettled(true);
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  return { manifest, settled };
}

/**
 * Prefers the narration rendered at publish time — same voice everywhere, real
 * seeking, plays with the screen off. Falls back to the browser's own speech
 * synthesis for editions that have no audio yet, so nothing ever goes silent.
 *
 * Both hooks run unconditionally because hook order must stay stable; only one
 * of them is ever driven.
 */
export function useNarration(
  blocks: string[],
  manifest: AudioManifest | null,
  storageKey?: string
): UseSpeechResult & { mode: 'audio' | 'speech' } {
  const speech = useSpeech(blocks, storageKey);
  const audio = useAudioNarration(manifest ?? EMPTY_MANIFEST, storageKey);

  return manifest
    ? { ...audio, mode: 'audio' }
    : { ...speech, mode: 'speech' };
}
