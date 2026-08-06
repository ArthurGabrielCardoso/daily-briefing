import { Link } from 'react-router-dom';
import type { UseSpeechResult } from '@/hooks/useSpeech';
import type { Briefing } from '@/types/briefing';
import { formatLongDate } from '@/lib/utils';
import { AudioPlayer } from './AudioPlayer';

interface MastheadProps {
  briefing: Briefing;
  /** Word count of the article body, computed on the client. */
  words: number;
  speech: UseSpeechResult;
  /** Observed by the sticky bar to know when the player has scrolled away. */
  playerRef: React.RefObject<HTMLDivElement | null>;
}

export function Masthead({ briefing, words, speech, playerRef }: MastheadProps) {
  const readMin = words ? Math.max(1, Math.round(words / 220)) : null;
  // The narration covers the read blocks, not the whole page — take the
  // estimate from the player itself so the two numbers never disagree.
  const audioMin = speech.total ? Math.max(1, Math.round(speech.total / 60)) : null;
  const dash = '—';

  return (
    <header className="masthead">
      <div className="wrap">
        <div className="masthead-top">
          <div className="brand">
            Briefing Diário
            <span className="for">
              Para Arthur · {briefing.weekday}, {formatLongDate(briefing.date)}
            </span>
          </div>
          <div className="meta-stats">
            <div>
              <b>{words ? words.toLocaleString('pt-BR') : dash}</b>
              <span>palavras</span>
            </div>
            <div>
              <b>{readMin ? `${readMin} min` : dash}</b>
              <span>de leitura</span>
            </div>
            <div>
              <b>{audioMin ? `${audioMin} min` : dash}</b>
              <span>de áudio (est.)</span>
            </div>
            <div>
              <b>{briefing.stats.destaques}</b>
              <span>destaques</span>
            </div>
            <div className="meta-archive">
              <Link to="/arquivo">Arquivo ↗</Link>
            </div>
          </div>
        </div>

        <div ref={playerRef}>
          <AudioPlayer speech={speech} />
        </div>
      </div>
    </header>
  );
}
