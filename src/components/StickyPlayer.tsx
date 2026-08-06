import { useEffect, useRef, useState, type RefObject } from 'react';
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
  const barRef = useRef<HTMLDivElement>(null);
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

  // On phones the bar sits at the bottom, so the page has to give back exactly
  // the space it covers — otherwise the sign-off hides underneath it, and a
  // rounded-up guess would leave a strip of page background showing.
  useEffect(() => {
    document.body.classList.toggle('has-sticky-player', shown);
    if (shown && barRef.current) {
      document.body.style.setProperty('--sticky-h', `${barRef.current.offsetHeight}px`);
    } else {
      document.body.style.removeProperty('--sticky-h');
    }
    return () => {
      document.body.classList.remove('has-sticky-player');
      document.body.style.removeProperty('--sticky-h');
    };
  }, [shown]);

  return (
    <div
      ref={barRef}
      className={shown ? 'sticky-player is-visible' : 'sticky-player'}
      aria-hidden={!shown}
    >
      <div className="sticky-player-inner">
        <AudioPlayer speech={speech} compact />
      </div>
    </div>
  );
}
