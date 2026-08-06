import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type SpeechStatus =
  | 'pronto'
  | 'reproduzindo'
  | 'pausado'
  | 'concluído'
  | 'indisponível';

/**
 * Android's TTS engine truncates long utterances, so every read block is spoken
 * as a sequence of sentence-aligned pieces of at most ~200 characters.
 * Highlighting stays at the block level; progress is tracked per character.
 */
const MAX_CHUNK = 200;

/** Starting guess for pt-BR narration speed, refined from real timings. */
const BASE_CHARS_PER_SEC = 14.5;

/** Voice preference is per reader, not per edition. */
const VOICE_KEY = 'briefing:voice';

export function splitForSpeech(text: string, max = MAX_CHUNK): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= max) return [trimmed];

  const sentences = trimmed.match(/[^.!?…]+[.!?…]*\s*/g) ?? [trimmed];
  const out: string[] = [];
  let cur = '';

  const flushOversized = () => {
    while (cur.length > max) {
      let cut = cur.lastIndexOf(' ', max);
      if (cut <= 0) cut = max;
      const head = cur.slice(0, cut).trim();
      if (head) out.push(head);
      cur = cur.slice(cut).trimStart();
    }
  };

  for (const piece of sentences) {
    if (cur && (cur + piece).length > max) {
      out.push(cur.trim());
      cur = piece;
    } else {
      cur += piece;
    }
    flushOversized();
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

/**
 * Ranks the Portuguese voices a device offers. Network-backed and "enhanced"
 * variants sound far better than the default local ones, but which one a given
 * phone or laptop actually has varies wildly — the ranking only decides the
 * starting point, and the reader can override it from the player.
 */
export function scoreVoice(v: SpeechSynthesisVoice): number {
  let score = 0;
  const name = v.name || '';
  const lang = (v.lang || '').toLowerCase().replace('_', '-');
  if (lang === 'pt-br') score += 10;
  else if (lang.indexOf('pt') === 0) score += 5;
  else return -1;
  if (/natural|neural/i.test(name)) score += 9;
  if (/premium|enhanced|siri/i.test(name)) score += 8;
  if (/google/i.test(name)) score += 7;
  if (/online/i.test(name)) score += 5;
  if (/microsoft/i.test(name)) score += 3;
  if (v.localService === false) score += 2;
  // "Compact" voices are the low-bitrate fallbacks — audibly the worst.
  if (/compact/i.test(name)) score -= 8;
  return score;
}

/** Trims the OS boilerplate so the picker shows something readable. */
export function voiceLabel(v: SpeechSynthesisVoice): string {
  return (v.name || 'Voz')
    .replace(/\s*-\s*Portuguese \(Brazil\)\s*/i, '')
    .replace(/\s*\(Brazil\)\s*/i, '')
    .replace(/português do Brasil/i, '(pt-BR)')
    .trim();
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Piece {
  text: string;
  block: number;
  /** Characters preceding this piece across the whole briefing. */
  offset: number;
}

export interface UseSpeechResult {
  supported: boolean;
  status: SpeechStatus;
  /** Index of the read block currently being spoken, or -1. */
  activeIndex: number;
  /** 0..100, advancing continuously as narration proceeds. */
  progress: number;
  elapsed: number;
  remaining: number;
  total: number;
  playing: boolean;
  paused: boolean;
  rate: number;
  /** Saved block index from a previous visit, or 0 when there is none. */
  resumeIndex: number;
  /** Portuguese voices this device offers, best first. */
  voices: SpeechSynthesisVoice[];
  /** voiceURI of the voice in use, or null while none is resolved. */
  voiceURI: string | null;
  setVoice: (uri: string) => void;
  setRate: (rate: number) => void;
  /** Play / pause / resume on a single control. */
  toggle: () => void;
  stop: () => void;
  playFrom: (index: number) => void;
  next: () => void;
  prev: () => void;
  /** Seek by fraction of the whole briefing (0..1) — used by the waveform. */
  seekFraction: (fraction: number) => void;
}

export function useSpeech(blocks: string[], storageKey?: string): UseSpeechResult {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  const supported = !!synth;

  const [status, setStatus] = useState<SpeechStatus>(supported ? 'pronto' : 'indisponível');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRateState] = useState(1);
  const [charsDone, setCharsDone] = useState(0);
  const [pieceFrac, setPieceFrac] = useState(0);
  const [charsPerSec, setCharsPerSec] = useState(BASE_CHARS_PER_SEC);
  const [resumeIndex, setResumeIndex] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const rateRef = useRef(1);
  const runRef = useRef(0);
  const cpsRef = useRef(BASE_CHARS_PER_SEC);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  // Per-piece timing anchors, used to interpolate between boundary events.
  const pieceRef = useRef({ index: 0, len: 1, startedAt: 0, baseFrac: 0, anchorAt: 0 });
  const rafRef = useRef<number | null>(null);

  const { pieces, totalChars } = useMemo(() => {
    const list: Piece[] = [];
    let offset = 0;
    blocks.forEach((text, block) => {
      for (const part of splitForSpeech(text)) {
        list.push({ text: part, block, offset });
        offset += part.length;
      }
    });
    return { pieces: list, totalChars: Math.max(1, offset) };
  }, [blocks]);

  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;

  // ---- Voice selection ----
  useEffect(() => {
    if (!synth) return;
    const pick = () => {
      const all = synth.getVoices();
      if (!all.length) return;

      const ranked = all
        .map((v) => ({ v, s: scoreVoice(v) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.v);
      setVoices(ranked);

      // A voice the reader chose before wins over the ranking.
      let saved: string | null = null;
      try {
        saved = window.localStorage.getItem(VOICE_KEY);
      } catch {
        saved = null;
      }
      const chosen =
        (saved && ranked.find((v) => v.voiceURI === saved)) || ranked[0] || null;
      voiceRef.current = chosen;
      setVoiceURI(chosen ? chosen.voiceURI : null);
    };
    pick();
    synth.addEventListener('voiceschanged', pick);
    return () => synth.removeEventListener('voiceschanged', pick);
  }, [synth]);

  // ---- Saved position ----
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      const n = raw ? parseInt(raw, 10) : 0;
      if (Number.isFinite(n) && n > 0 && n < blocksRef.current.length) setResumeIndex(n);
      else setResumeIndex(0);
    } catch {
      setResumeIndex(0);
    }
  }, [storageKey]);

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

  // ---- Smooth interpolation between boundary events ----
  const stopTicker = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startTicker = useCallback(() => {
    stopTicker();
    const tick = () => {
      const p = pieceRef.current;
      const secsSinceAnchor = (performance.now() - p.anchorAt) / 1000;
      const charsSinceAnchor = secsSinceAnchor * cpsRef.current * rateRef.current;
      const frac = Math.min(1, p.baseFrac + charsSinceAnchor / Math.max(1, p.len));
      setPieceFrac(frac);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopTicker]);

  const speakPiece = useCallback(
    (pieceIndex: number, run: number) => {
      if (!synth) return;
      const list = piecesRef.current;

      if (pieceIndex >= list.length) {
        stopTicker();
        setPlaying(false);
        setPaused(false);
        setStatus('concluído');
        setActiveIndex(-1);
        setCharsDone(0);
        setPieceFrac(0);
        remember(0);
        return;
      }

      const piece = list[pieceIndex];
      setActiveIndex(piece.block);
      setCharsDone(piece.offset);
      setPieceFrac(0);
      remember(piece.block);

      const now = performance.now();
      pieceRef.current = {
        index: pieceIndex,
        len: piece.text.length,
        startedAt: now,
        baseFrac: 0,
        anchorAt: now,
      };

      const utter = new SpeechSynthesisUtterance(piece.text);
      utter.lang = 'pt-BR';
      if (voiceRef.current) utter.voice = voiceRef.current;
      utter.rate = rateRef.current;

      utter.onboundary = (e) => {
        if (run !== runRef.current) return;
        const idx = e.charIndex;
        if (typeof idx !== 'number' || idx < 0) return;
        const frac = Math.min(1, idx / Math.max(1, piece.text.length));
        pieceRef.current.baseFrac = frac;
        pieceRef.current.anchorAt = performance.now();
        setPieceFrac(frac);
      };

      utter.onend = () => {
        // A cancel() from a newer run also fires onend — ignore stale ones.
        if (run !== runRef.current) return;
        // Calibrate narration speed from what actually happened.
        const secs = (performance.now() - pieceRef.current.startedAt) / 1000;
        if (secs > 0.4) {
          const observed = piece.text.length / secs / rateRef.current;
          if (observed > 3 && observed < 60) {
            const blended = cpsRef.current * 0.7 + observed * 0.3;
            cpsRef.current = blended;
            setCharsPerSec(blended);
          }
        }
        speakPiece(pieceIndex + 1, run);
      };

      utter.onerror = () => {
        if (run !== runRef.current) return;
        runRef.current++;
        stopTicker();
        setPlaying(false);
        setPaused(false);
        setStatus('indisponível');
      };

      synth.speak(utter);
    },
    [synth, stopTicker, remember]
  );

  const playFromPiece = useCallback(
    (pieceIndex: number) => {
      if (!synth) return;
      const list = piecesRef.current;
      if (!list.length) return;
      const target = Math.max(0, Math.min(list.length - 1, pieceIndex));
      const run = ++runRef.current;
      synth.cancel();
      setPlaying(true);
      setPaused(false);
      setStatus('reproduzindo');
      speakPiece(target, run);
      startTicker();
    },
    [synth, speakPiece, startTicker]
  );

  const playFrom = useCallback(
    (blockIndex: number) => {
      const list = piecesRef.current;
      const target = Math.max(0, Math.min(blocksRef.current.length - 1, blockIndex));
      let pieceIndex = list.findIndex((p) => p.block === target);
      if (pieceIndex < 0) pieceIndex = 0;
      playFromPiece(pieceIndex);
    },
    [playFromPiece]
  );

  const stop = useCallback(() => {
    if (!synth) return;
    runRef.current++;
    synth.cancel();
    stopTicker();
    setPlaying(false);
    setPaused(false);
    setActiveIndex(-1);
    setStatus('pronto');
    setCharsDone(0);
    setPieceFrac(0);
    remember(0);
    setResumeIndex(0);
  }, [synth, stopTicker, remember]);

  const toggle = useCallback(() => {
    if (!synth) return;
    if (!playing && !paused) {
      // A fresh start picks up where the last visit stopped.
      playFrom(status === 'concluído' ? 0 : resumeIndex);
    } else if (playing && !paused) {
      synth.pause();
      stopTicker();
      setPaused(true);
      setStatus('pausado');
    } else if (paused) {
      synth.resume();
      // Re-anchor so interpolation does not jump for the paused interval.
      pieceRef.current.anchorAt = performance.now();
      startTicker();
      setPaused(false);
      setStatus('reproduzindo');
    }
  }, [synth, playing, paused, status, resumeIndex, playFrom, startTicker, stopTicker]);

  const setRate = useCallback(
    (next: number) => {
      rateRef.current = next;
      setRateState(next);
      // Rate can only be applied to a fresh utterance — restart the current piece.
      if (playing && !paused) playFromPiece(pieceRef.current.index);
    },
    [playing, paused, playFromPiece]
  );

  const setVoice = useCallback(
    (uri: string) => {
      const next = voices.find((v) => v.voiceURI === uri);
      if (!next) return;
      voiceRef.current = next;
      setVoiceURI(uri);
      try {
        window.localStorage.setItem(VOICE_KEY, uri);
      } catch {
        /* storage unavailable — the choice just will not persist */
      }
      // Like rate, a voice only takes effect on a new utterance.
      if (playing && !paused) playFromPiece(pieceRef.current.index);
    },
    [voices, playing, paused, playFromPiece]
  );

  const next = useCallback(() => {
    const at = activeIndex < 0 ? 0 : activeIndex;
    playFrom(Math.min(blocksRef.current.length - 1, at + 1));
  }, [activeIndex, playFrom]);

  const prev = useCallback(() => {
    const at = activeIndex < 0 ? 0 : activeIndex;
    playFrom(Math.max(0, at - 1));
  }, [activeIndex, playFrom]);

  const seekFraction = useCallback(
    (fraction: number) => {
      const list = piecesRef.current;
      if (!list.length) return;
      const targetChar = Math.max(0, Math.min(1, fraction)) * totalChars;
      let pieceIndex = list.findIndex((p) => p.offset + p.text.length > targetChar);
      if (pieceIndex < 0) pieceIndex = list.length - 1;
      playFromPiece(pieceIndex);
    },
    [totalChars, playFromPiece]
  );

  useEffect(() => {
    if (!synth) return;
    const cancel = () => synth.cancel();
    window.addEventListener('beforeunload', cancel);
    return () => {
      window.removeEventListener('beforeunload', cancel);
      runRef.current++;
      synth.cancel();
    };
  }, [synth]);

  useEffect(() => stopTicker, [stopTicker]);

  const pieceLen = pieceRef.current.len;
  const spokenChars = Math.min(
    totalChars,
    charsDone + (activeIndex >= 0 ? pieceFrac * pieceLen : 0)
  );
  const progress = (spokenChars / totalChars) * 100;
  const total = totalChars / (charsPerSec * rate);
  const elapsed = spokenChars / (charsPerSec * rate);

  return {
    supported,
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
    voices,
    voiceURI,
    setVoice,
    setRate,
    toggle,
    stop,
    playFrom,
    next,
    prev,
    seekFraction,
  };
}
