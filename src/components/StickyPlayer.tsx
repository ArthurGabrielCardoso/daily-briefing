import { useEffect, useState, type RefObject } from 'react';
import type { UseSpeechResult } from '@/hooks/useSpeech';
import { AudioPlayer } from './AudioPlayer';

interface StickyPlayerProps {
  speech: UseSpeechResult;
  /** The masthead player — the sticky bar appears once this scrolls away. */
  anchorRef: RefObject<HTMLElement | null>;
}

/**
 * Once narration is running and the masthead player has scrolled out of view,
 * a compact bar follows the reader so pause and skip stay one tap away.
 */
export function StickyPlayer({ speech, anchorRef }: StickyPlayerProps) {
  const [anchorVisible, setAnchorVisible] = useState(true);
  const active = speech.playing || speech.paused;

  useEffect(() => {
    const el = anchorRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setAnchorVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [anchorRef]);

  const shown = active && !anchorVisible;

  return (
    <div className={shown ? 'sticky-player is-visible' : 'sticky-player'} aria-hidden={!shown}>
      <div className="sticky-player-inner">
        <AudioPlayer speech={speech} compact />
      </div>
    </div>
  );
}
