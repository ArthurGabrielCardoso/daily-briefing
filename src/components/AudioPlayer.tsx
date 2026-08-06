import { useEffect, useMemo, useRef, useState } from 'react';
import { formatClock, type UseSpeechResult } from '@/hooks/useSpeech';

/** Full-detail waveform; smaller widths sample this down so it always fits. */
const MAX_BARS = 64;
/** Each bar is 2px wide with a 2px gap, so a bar costs 4px of track. */
const BAR_PITCH = 4;
const MIN_BARS = 14;

const SPEEDS: { rate: number; label: string }[] = [
  { rate: 0.9, label: '0,9×' },
  { rate: 1, label: '1×' },
  { rate: 1.15, label: '1,15×' },
  { rate: 1.3, label: '1,3×' },
];

/** Deterministic bar heights — the waveform must look identical every load. */
const BASE_HEIGHTS: number[] = (() => {
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: MAX_BARS }, () => 20 + Math.round(rand() * 80));
})();

/** Evenly samples the master waveform down to `count` bars. */
function sampleHeights(count: number): number[] {
  if (count >= MAX_BARS) return BASE_HEIGHTS;
  return Array.from(
    { length: count },
    (_, i) => BASE_HEIGHTS[Math.round((i * (MAX_BARS - 1)) / (count - 1))]
  );
}

/** Tracks an element's width so the waveform can never overflow its track. */
function useElementWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

export interface AudioPlayerProps {
  speech: UseSpeechResult;
  /** Compact layout for the bar that follows you down the page. */
  compact?: boolean;
}

export function AudioPlayer({ speech, compact }: AudioPlayerProps) {
  const {
    supported,
    status,
    progress,
    elapsed,
    remaining,
    playing,
    paused,
    rate,
    resumeIndex,
    setRate,
    toggle,
    stop,
    next,
    prev,
    seekFraction,
  } = speech;

  const waveRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(waveRef);
  const barCount = width
    ? Math.max(MIN_BARS, Math.min(MAX_BARS, Math.floor((width + 2) / BAR_PITCH)))
    : MAX_BARS;
  const heights = useMemo(() => sampleHeights(barCount), [barCount]);

  const showPause = playing && !paused;
  const started = playing || paused;

  const label = !supported
    ? 'Leitura em voz não é suportada neste navegador'
    : started
      ? 'Ouvindo o briefing de hoje'
      : resumeIndex > 0
        ? 'Retomar de onde você parou'
        : 'Ouvir o briefing de hoje';

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!supported || !waveRef.current) return;
    const rect = waveRef.current.getBoundingClientRect();
    seekFraction((e.clientX - rect.left) / rect.width);
  };

  const bars = (
    <div className="wf-row">
      {heights.map((h, i) => (
        <div className="wf-bar" key={i} style={{ height: `${h}%` }} />
      ))}
    </div>
  );

  const waveform = (
    <div
      className="waveform"
      ref={waveRef}
      onClick={seek}
      role="slider"
      tabIndex={supported ? 0 : -1}
      aria-label="Posição da narração"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      {bars}
      {/* Clipping (rather than resizing) keeps the gold bars aligned with the
          grey ones underneath, so the fill tracks exactly what has been read. */}
      <div className="wf-progress" style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}>
        {bars}
      </div>
    </div>
  );

  const transport = (
    <>
      <button
        className="skip-btn"
        onClick={prev}
        disabled={!supported}
        aria-label="Parágrafo anterior"
        title="Parágrafo anterior"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 6h2v12H7zM19 6v12l-9-6z" />
        </svg>
      </button>
      <button
        className="play-btn"
        onClick={toggle}
        disabled={!supported}
        aria-label={showPause ? 'Pausar' : 'Reproduzir'}
      >
        {showPause ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        className="skip-btn"
        onClick={next}
        disabled={!supported}
        aria-label="Próximo parágrafo"
        title="Próximo parágrafo"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M15 6h2v12h-2zM5 6l9 6-9 6z" />
        </svg>
      </button>
    </>
  );

  const stopButton = (
    <button className="stop-btn" onClick={stop} aria-label="Parar" title="Parar">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="6" width="12" height="12" rx="1.5" />
      </svg>
    </button>
  );

  if (compact) {
    return (
      <div className="player player-compact">
        <div className="player-transport">{transport}</div>
        <div className="waveform-area">
          {waveform}
          <div className="player-sub">
            <span className="player-time">{formatClock(elapsed)}</span>
            <span aria-live="polite">{status}</span>
            <span className="player-time">−{formatClock(remaining)}</span>
          </div>
        </div>
        {stopButton}
      </div>
    );
  }

  return (
    <div className="player">
      <div className="player-transport">{transport}</div>

      <div className="waveform-area">
        {waveform}
        <div className="player-sub">
          <span className="player-label">{label}</span>
          <span className="player-meta">
            <span className="player-time">
              {formatClock(elapsed)} / {formatClock(elapsed + remaining)}
            </span>
            <span aria-live="polite">{status}</span>
          </span>
        </div>
      </div>

      <div className="player-controls-right">
        <div className="speed-select" role="group" aria-label="Velocidade da narração">
          {SPEEDS.map((s) => (
            <button
              key={s.rate}
              className={s.rate === rate ? 'speed-btn active' : 'speed-btn'}
              onClick={() => setRate(s.rate)}
              aria-pressed={s.rate === rate}
            >
              {s.label}
            </button>
          ))}
        </div>
        {stopButton}
      </div>
    </div>
  );
}
