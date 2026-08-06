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
 * Highlighting and progress stay at the block level.
 */
const MAX_CHUNK = 200;

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
 * Network-backed voices ("Google", "Natural", "Neural", "Online") sound far
 * better than the default local ones — score them up. Non-Portuguese voices
 * are rejected outright.
 */
function scoreVoice(v: SpeechSynthesisVoice): number {
  let score = 0;
  const name = v.name || '';
  const lang = (v.lang || '').toLowerCase().replace('_', '-');
  if (lang === 'pt-br') score += 10;
  else if (lang.indexOf('pt') === 0) score += 5;
  else return -1;
  if (/google/i.test(name)) score += 8;
  if (/natural|online|neural/i.test(name)) score += 7;
  if (/microsoft/i.test(name)) score += 3;
  if (v.localService === false) score += 2;
  return score;
}

export interface UseSpeechResult {
  supported: boolean;
  status: SpeechStatus;
  /** Index of the read block currently being spoken, or -1. */
  activeIndex: number;
  /** 0..100, advances one read block at a time. */
  progress: number;
  playing: boolean;
  paused: boolean;
  rate: number;
  setRate: (rate: number) => void;
  /** Play / pause / resume on a single control. */
  toggle: () => void;
  stop: () => void;
  playFrom: (index: number) => void;
}

export function useSpeech(blocks: string[]): UseSpeechResult {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  const supported = !!synth;

  const [status, setStatus] = useState<SpeechStatus>(supported ? 'pronto' : 'indisponível');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRateState] = useState(1);

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const rateRef = useRef(1);
  const runRef = useRef(0);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  /** Flattened utterance pieces, each tagged with its owning read block. */
  const pieces = useMemo(() => {
    const list: { text: string; block: number }[] = [];
    blocks.forEach((text, block) => {
      for (const part of splitForSpeech(text)) list.push({ text: part, block });
    });
    return list;
  }, [blocks]);
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;

  // ---- Voice selection ----
  useEffect(() => {
    if (!synth) return;
    const pick = () => {
      const voices = synth.getVoices();
      if (!voices.length) return;
      let best: SpeechSynthesisVoice | null = null;
      let bestScore = -1;
      voices.forEach((v) => {
        const s = scoreVoice(v);
        if (s > bestScore) {
          bestScore = s;
          best = v;
        }
      });
      voiceRef.current = bestScore >= 0 ? best : null;
    };
    pick();
    synth.addEventListener('voiceschanged', pick);
    return () => synth.removeEventListener('voiceschanged', pick);
  }, [synth]);

  const speakPiece = useCallback(
    (pieceIndex: number, run: number) => {
      if (!synth) return;
      const list = piecesRef.current;
      if (pieceIndex >= list.length) {
        setPlaying(false);
        setPaused(false);
        setStatus('concluído');
        setActiveIndex(-1);
        return;
      }
      const piece = list[pieceIndex];
      setActiveIndex(piece.block);

      const utter = new SpeechSynthesisUtterance(piece.text);
      utter.lang = 'pt-BR';
      if (voiceRef.current) utter.voice = voiceRef.current;
      utter.rate = rateRef.current;
      utter.onend = () => {
        // A cancel() from a newer run also fires onend — ignore stale ones.
        if (run !== runRef.current) return;
        speakPiece(pieceIndex + 1, run);
      };
      utter.onerror = () => {
        if (run !== runRef.current) return;
        runRef.current++;
        setPlaying(false);
        setPaused(false);
        setStatus('indisponível');
      };
      synth.speak(utter);
    },
    [synth]
  );

  const playFrom = useCallback(
    (blockIndex: number) => {
      if (!synth) return;
      const list = piecesRef.current;
      if (!list.length) return;
      const target = Math.max(0, Math.min(blocksRef.current.length - 1, blockIndex));
      let pieceIndex = list.findIndex((p) => p.block === target);
      if (pieceIndex < 0) pieceIndex = 0;

      const run = ++runRef.current;
      synth.cancel();
      setPlaying(true);
      setPaused(false);
      setStatus('reproduzindo');
      speakPiece(pieceIndex, run);
    },
    [synth, speakPiece]
  );

  const stop = useCallback(() => {
    if (!synth) return;
    runRef.current++;
    synth.cancel();
    setPlaying(false);
    setPaused(false);
    setActiveIndex(-1);
    setStatus('pronto');
  }, [synth]);

  const toggle = useCallback(() => {
    if (!synth) return;
    if (!playing && !paused) {
      playFrom(0);
    } else if (playing && !paused) {
      synth.pause();
      setPaused(true);
      setStatus('pausado');
    } else if (paused) {
      synth.resume();
      setPaused(false);
      setStatus('reproduzindo');
    }
  }, [synth, playing, paused, playFrom]);

  const setRate = useCallback(
    (next: number) => {
      rateRef.current = next;
      setRateState(next);
      // Rate can only be applied to a fresh utterance — restart the current block.
      if (playing && !paused) {
        playFrom(activeIndex < 0 ? 0 : activeIndex);
      }
    },
    [playing, paused, activeIndex, playFrom]
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

  const progress =
    blocks.length && activeIndex >= 0 ? Math.min(100, (activeIndex / blocks.length) * 100) : 0;

  return {
    supported,
    status,
    activeIndex,
    progress,
    playing,
    paused,
    rate,
    setRate,
    toggle,
    stop,
    playFrom,
  };
}
