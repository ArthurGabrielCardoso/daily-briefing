import { Link } from 'react-router-dom';
import type { UseSpeechResult } from '@/hooks/useSpeech';
import type { Briefing } from '@/types/briefing';
import { formatLongDate } from '@/lib/utils';
import { AudioPlayer } from './AudioPlayer';

interface MastheadProps {
  briefing: Briefing;
  speech: UseSpeechResult;
  /** Observed by the sticky bar to know when the player has scrolled away. */
  playerRef: React.RefObject<HTMLDivElement | null>;
}

export function Masthead({ briefing, speech, playerRef }: MastheadProps) {
  return (
    <header className="masthead">
      <div className="wrap">
        <div className="masthead-top">
          <div className="brand">
            Briefing Diário
            <span className="for">
              {briefing.weekday}, {formatLongDate(briefing.date)}
            </span>
          </div>
          <div className="meta-archive">
            <Link to="/arquivo">Arquivo ↗</Link>
          </div>
        </div>

        <div ref={playerRef}>
          <AudioPlayer speech={speech} />
        </div>
      </div>
    </header>
  );
}
