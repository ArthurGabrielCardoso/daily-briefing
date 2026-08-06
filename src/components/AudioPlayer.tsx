import { useMemo, useRef } from 'react';
import type { UseSpeechResult } from '@/hooks/useSpeech';

const BAR_COUNT = 64;

const SPEEDS: { rate: number; label: string }[] = [
  { rate: 0.9, label: '0,9×' },
  { rate: 1, label: '1×' },
  { rate: 1.15, label: '1,15×' },
  { rate: 1.3, label: '1,3×' },
];

/** Deterministic bar heights — the waveform must look identical every load. */
function waveformHeights(): number[] {
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: BAR_COUNT }, () => 20 + Math.round(rand() * 80));
}

interface AudioPlayerProps {
  speech: UseSpeechResult;
  /** Number of read blocks — the waveform maps 1:1 onto them. */
  blockCount: number;
}

export function AudioPlayer({ speech, blockCount }: AudioPlayerProps) {
  const { supported, status, progress, playing, paused, rate, setRate, toggle, stop, playFrom } =
    speech;
  const heights = useMemo(waveformHeights, []);
  const waveRef = useRef<HTMLDivElement>(null);

  const showPause = playing && !paused;
  const label = !supported
    ? 'Leitura em voz não é suportada neste navegador'
    : playing || paused
      ? 'Ouvindo o briefing de hoje'
      : 'Ouvir o briefing de hoje';

  const onWaveClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!supported || !blockCount || !waveRef.current) return;
    const rect = waveRef.current.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(blockCount - 1, Math.floor(frac * blockCount)));
    playFrom(idx);
  };

  const bars = (
    <div className="wf-row">
      {heights.map((h, i) => (
        <div className="wf-bar" key={i} style={{ height: `${h}%` }} />
      ))}
    </div>
  );

  return (
    <div className="player">
      <button className="play-btn" onClick={toggle} aria-label={showPause ? 'Pausar' : 'Reproduzir'}>
        {showPause ? (
          <svg viewBox="0 0 24 24" fill="#0B1E3D">
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="#0B1E3D">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="waveform-area">
        <div className="waveform" ref={waveRef} onClick={onWaveClick}>
          {bars}
          <div className="wf-progress" style={{ width: `${progress}%` }}>
            {bars}
          </div>
        </div>
        <div className="player-sub">
          <span>{label}</span>
          <span>{status}</span>
        </div>
      </div>

      <div className="player-controls-right">
        <div className="speed-select">
          {SPEEDS.map((s) => (
            <button
              key={s.rate}
              className={s.rate === rate ? 'speed-btn active' : 'speed-btn'}
              onClick={() => setRate(s.rate)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button className="stop-btn" onClick={stop} aria-label="Parar" title="Parar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="#C9C4B4">
            <rect x="6" y="6" width="12" height="12" rx="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
