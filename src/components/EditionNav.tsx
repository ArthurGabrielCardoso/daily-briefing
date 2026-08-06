import { Link } from 'react-router-dom';
import { formatLongDate } from '@/lib/utils';

interface EditionNavProps {
  /** All edition dates, newest first. */
  dates: string[];
  current: string;
}

/** Move between consecutive editions without going through the archive. */
export function EditionNav({ dates, current }: EditionNavProps) {
  const i = dates.indexOf(current);
  if (i < 0) return null;
  const newer = i > 0 ? dates[i - 1] : null;
  const older = i < dates.length - 1 ? dates[i + 1] : null;
  if (!newer && !older && dates.length <= 1) return null;

  return (
    <nav className="edition-nav" aria-label="Navegação entre edições">
      <div className="wrap edition-nav-inner">
        {older ? (
          <Link className="edition-nav-link" to={`/briefing/${older}`}>
            <span className="edition-nav-dir">← Edição anterior</span>
            <span className="edition-nav-date">{formatLongDate(older)}</span>
          </Link>
        ) : (
          <span className="edition-nav-link is-empty" aria-hidden="true" />
        )}

        <Link className="edition-nav-all" to="/arquivo">
          Todas as edições
        </Link>

        {newer ? (
          <Link className="edition-nav-link is-next" to={`/briefing/${newer}`}>
            <span className="edition-nav-dir">Edição seguinte →</span>
            <span className="edition-nav-date">{formatLongDate(newer)}</span>
          </Link>
        ) : (
          <span className="edition-nav-link is-empty" aria-hidden="true" />
        )}
      </div>
    </nav>
  );
}
