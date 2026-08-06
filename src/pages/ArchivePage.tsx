import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatLongDate, weekdayOf } from '@/lib/utils';

export function ArchivePage() {
  const [dates, setDates] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Arquivo — Briefing Diário';
    fetch('/api/briefings')
      .then((res) => res.json())
      .then((json) => setDates(Array.isArray(json.dates) ? json.dates : []))
      .catch(() => setError('Não foi possível carregar o arquivo.'));
  }, []);

  return (
    <div>
      <header className="masthead">
        <div className="wrap">
          <div className="masthead-top">
            <div className="brand">
              Briefing Diário
              <span className="for">Arquivo · todas as edições</span>
            </div>
            <div className="meta-stats">
              <div>
                <b>{dates ? dates.length : '—'}</b>
                <span>{dates && dates.length === 1 ? 'edição' : 'edições'}</span>
              </div>
            </div>
          </div>
          <div>
            <Link to="/" className="arquivo-back">
              ← Voltar para a edição mais recente
            </Link>
          </div>
        </div>
      </header>

      <div className="arquivo">
        <div className="wrap">
          <h1 className="arquivo-title">Todas as edições</h1>
          <p className="arquivo-lede">
            Cada dia, uma leitura. Escolha uma data para reabrir o briefing daquela manhã —
            com as matérias, as fontes e o áudio.
          </p>

          {error ? <div className="arquivo-empty">{error}</div> : null}

          {!error && dates === null ? (
            <div className="arquivo-empty">Carregando…</div>
          ) : null}

          {!error && dates && dates.length === 0 ? (
            <div className="arquivo-empty">Nenhuma edição publicada ainda.</div>
          ) : null}

          {!error && dates && dates.length > 0 ? (
            <div className="arquivo-grid">
              {dates.map((d) => (
                <Link className="arquivo-card" to={`/briefing/${d}`} key={d}>
                  <div className="arquivo-card-day">{weekdayOf(d)}</div>
                  <div className="arquivo-card-date">{formatLongDate(d)}</div>
                  <div className="arquivo-card-go">Abrir edição ↗</div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
