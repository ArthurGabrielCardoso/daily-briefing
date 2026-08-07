import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface VoiceSample {
  name: string;
  short: string;
  gender: 'F' | 'M';
  file: string;
  duration: number;
}

interface SamplesManifest {
  text: string;
  generatedAt: string;
  voices: VoiceSample[];
  current: string | null;
}

/**
 * Side-by-side of every pt-BR Chirp 3 HD voice reading the same excerpt.
 * Google publishes no readable description of these voices, so choosing one by
 * ear is the only reliable way.
 */
export function VoicesPage() {
  const [data, setData] = useState<SamplesManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todas' | 'F' | 'M'>('todas');

  useEffect(() => {
    document.title = 'Vozes — Briefing Diário';
    fetch('/api/voices')
      .then((res) => {
        if (!res.ok) throw new Error('As amostras ainda não foram geradas.');
        return res.json();
      })
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const shown = data?.voices.filter((v) => filter === 'todas' || v.gender === filter) ?? [];

  return (
    <div>
      <header className="masthead">
        <div className="wrap">
          <div className="masthead-top">
            <div className="brand">
              Briefing Diário
              <span className="for">Vozes · escolha a narração</span>
            </div>
            <div className="meta-archive">
              <Link to="/">← Voltar ao briefing</Link>
            </div>
          </div>
        </div>
      </header>

      <div className="arquivo">
        <div className="wrap">
          <h1 className="arquivo-title">Qual voz vai narrar</h1>

          {error ? (
            <div className="arquivo-empty">{error}</div>
          ) : !data ? (
            <div className="arquivo-empty">Carregando amostras…</div>
          ) : (
            <>
              <p className="arquivo-lede">
                Todas as {data.voices.length} vozes lendo o mesmo trecho, para a comparação
                ser justa. Ouça algumas e me diga o nome da que preferir.
              </p>
              <blockquote className="voz-trecho">“{data.text}”</blockquote>

              <div className="voz-filtros" role="group" aria-label="Filtrar por timbre">
                {(['todas', 'F', 'M'] as const).map((f) => (
                  <button
                    key={f}
                    className={filter === f ? 'voz-filtro is-active' : 'voz-filtro'}
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                  >
                    {f === 'todas' ? 'Todas' : f === 'F' ? 'Femininas' : 'Masculinas'}
                  </button>
                ))}
              </div>

              <div className="voz-grid">
                {shown.map((v) => (
                  <div
                    className={v.name === data.current ? 'voz-card is-current' : 'voz-card'}
                    key={v.name}
                  >
                    <div className="voz-nome">
                      {v.short}
                      <span className="voz-tag">{v.gender === 'F' ? 'feminina' : 'masculina'}</span>
                      {v.name === data.current ? <span className="voz-atual">em uso</span> : null}
                    </div>
                    <audio controls preload="none" src={`/audio/_amostras/${v.file}`} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
