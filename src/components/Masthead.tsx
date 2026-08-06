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
  blockCount: number;
}

export function Masthead({ briefing, words, speech, blockCount }: MastheadProps) {
  const readMin = words ? Math.max(1, Math.round(words / 220)) : null;
  const audioMin = words ? Math.max(1, Math.round(words / 155)) : null;
  const dash = '—';

  return (
    <header className="masthead">
      <div className="wrap">
        <div className="masthead-top">
          <div className="brand">
            <Link to="/arquivo">Briefing Diário</Link>
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
          </div>
        </div>

        <AudioPlayer speech={speech} blockCount={blockCount} />
      </div>
    </header>
  );
}
