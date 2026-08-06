import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SpeechStatus, UseSpeechResult } from './useSpeech';

export interface AudioManifestBlock {
  index: number;
  file: string;
  chars: number;
  duration: number;
}

export interface AudioManifest {
  date: string;
  voice: string;
  generatedAt: string;
  totalChars: number;
  totalDuration: number;
  blocks: AudioManifestBlock[];
}

/**
 * Plays the narration rendered at publish time: one MP3 per read block, queued
 * back to back. Compared with the browser's speech synthesis this gives the same
 * voice on every device, real seeking, and playback that survives a locked
 * screen — plus lock-screen controls via the Media Session API.
 */
export function useAudioNarration(
  manifest: AudioManifest,
  storageKey?: string
): UseSpeechResult {
  const [status, setStatus] = useState<SpeechStatus>('pronto');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRateState] = useState(1);
  const [elapsedInBlock, setElapsedInBlock] = useState(0);
  const [resumeIndex, setResumeIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const indexRef = useRef(0);
  const rateRef = useRef(1);

  const blocks = manifest.blocks;
  const total = manifest.totalDuration;

  /** Seconds of narration that precede each block. */
  const offsets = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (const b of blocks) {
      out.push(acc);
      acc += b.duration;
    }
    return out;
  }, [blocks]);

  const srcFor = useCallback(
    (i: number) => `/audio/${manifest.date}/${blocks[i].file}`,
    [manifest.date, blocks]
  );

  // ---- Saved position ----
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      const n = raw ? parseInt(raw, 10) : 0;
      setResumeIndex(Number.isFinite(n) && n > 0 && n < blocks.length ? n : 0);
    } catch {
      setResumeIndex(0);
    }
  }, [storageKey, blocks.length]);

  const remember = useCallback(
    (index: number) => {
      if (!storageKey) return;
      try {
        if (index > 0) window.localStorage.setItem(storageKey, String(index));
        else window.localStorage.removeItem(storageKey);
      } catch {
        /* storage unavailable — position simply is not remembered */
      }
    },
    [storageKey]
  );

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = 'auto';
      audioRef.current = el;
    }
    return audioRef.current;
  }, []);

  /** Warms the next block so the gap between paragraphs stays imperceptible. */
  const preloadNext = useCallback(
    (i: number) => {
      const next = i + 1;
      if (next >= blocks.length) return;
      if (!preloadRef.current) preloadRef.current = new Audio();
      preloadRef.current.src = srcFor(next);
      preloadRef.current.preload = 'auto';
      preloadRef.current.load();
    },
    [blocks.length, srcFor]
  );

  const playIndex = useCallback(
    (i: number, at = 0) => {
      if (!blocks.length) return;
      const target = Math.max(0, Math.min(blocks.length - 1, i));
      const el = ensureAudio();
      indexRef.current = target;
      setActiveIndex(target);
      remember(target);
      setElapsedInBlock(at);

      el.src = srcFor(target);
      el.playbackRate = rateRef.current;
      if (at > 0) el.currentTime = at;
      void el
        .play()
        .then(() => {
          setPlaying(true);
          setPaused(false);
          setStatus('reproduzindo');
          preloadNext(target);
        })
        .catch(() => {
          setPlaying(false);
          setPaused(false);
          setStatus('indisponível');
        });
    },
    [blocks.length, ensureAudio, srcFor, remember, preloadNext]
  );

  // ---- Element events ----
  useEffect(() => {
    const el = ensureAudio();

    const onTime = () => setElapsedInBlock(el.currentTime);
    const onEnded = () => {
      const next = indexRef.current + 1;
      if (next >= blocks.length) {
        setPlaying(false);
        setPaused(false);
        setActiveIndex(-1);
        setElapsedInBlock(0);
        setStatus('concluído');
        remember(0);
        return;
      }
      playIndex(next);
    };
    const onError = () => {
      setPlaying(false);
      setPaused(false);
      setStatus('indisponível');
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
    };
  }, [ensureAudio, blocks.length, playIndex, remember]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      preloadRef.current = null;
    };
  }, []);

  const playFrom = useCallback((i: number) => playIndex(i), [playIndex]);

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    indexRef.current = 0;
    setPlaying(false);
    setPaused(false);
    setActiveIndex(-1);
    setElapsedInBlock(0);
    setStatus('pronto');
    remember(0);
    setResumeIndex(0);
  }, [remember]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!playing && !paused) {
      playIndex(status === 'concluído' ? 0 : resumeIndex);
      return;
    }
    if (!el) return;
    if (playing && !paused) {
      el.pause();
      setPaused(true);
      setStatus('pausado');
    } else {
      void el.play().then(() => {
        setPaused(false);
        setStatus('reproduzindo');
      });
    }
  }, [playing, paused, status, resumeIndex, playIndex]);

  const setRate = useCallback((next: number) => {
    rateRef.current = next;
    setRateState(next);
    // Unlike speech synthesis, this applies instantly with no restart.
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, []);

  const next = useCallback(() => {
    playIndex(Math.min(blocks.length - 1, (activeIndex < 0 ? 0 : activeIndex) + 1));
  }, [activeIndex, blocks.length, playIndex]);

  const prev = useCallback(() => {
    playIndex(Math.max(0, (activeIndex < 0 ? 0 : activeIndex) - 1));
  }, [activeIndex, playIndex]);

  const seekFraction = useCallback(
    (fraction: number) => {
      const targetSecs = Math.max(0, Math.min(1, fraction)) * total;
      let i = offsets.findIndex((start, idx) => targetSecs < start + blocks[idx].duration);
      if (i < 0) i = blocks.length - 1;
      playIndex(i, Math.max(0, targetSecs - offsets[i]));
    },
    [total, offsets, blocks, playIndex]
  );

  // ---- Lock-screen / headset controls ----
  useEffect(() => {
    // This hook is also mounted (idle) when narration falls back to speech
    // synthesis, so it must not claim the lock screen unless it owns playback.
    if (!blocks.length) return;
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({
      title: 'Briefing Diário',
      artist: new Date(manifest.date + 'T12:00:00').toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      album: 'Para Arthur',
    });
    ms.setActionHandler('play', () => toggle());
    ms.setActionHandler('pause', () => toggle());
    ms.setActionHandler('previoustrack', () => prev());
    ms.setActionHandler('nexttrack', () => next());
    return () => {
      ms.setActionHandler('play', null);
      ms.setActionHandler('pause', null);
      ms.setActionHandler('previoustrack', null);
      ms.setActionHandler('nexttrack', null);
    };
  }, [manifest.date, blocks.length, toggle, prev, next]);

  useEffect(() => {
    if (!blocks.length) return;
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playing && !paused ? 'playing' : paused ? 'paused' : 'none';
  }, [blocks.length, playing, paused]);

  const elapsed = activeIndex >= 0 ? offsets[activeIndex] + elapsedInBlock : 0;
  const progress = total ? Math.min(100, (elapsed / total) * 100) : 0;

  return {
    supported: true,
    status,
    activeIndex,
    progress,
    elapsed,
    remaining: Math.max(0, total - elapsed),
    total,
    playing,
    paused,
    rate,
    resumeIndex,
    voices: [],
    voiceURI: null,
    setVoice: () => {},
    setRate,
    toggle,
    stop,
    playFrom,
    next,
    prev,
    seekFraction,
  };
}
