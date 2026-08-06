import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { parseBriefing, type Briefing } from '@/types/briefing';
import { useSpeech } from '@/hooks/useSpeech';
import { ReadingProvider } from '@/components/ReadBlock';
import { Masthead } from '@/components/Masthead';
import { SeuDia } from '@/components/SeuDia';
import { Capa } from '@/components/Capa';
import { Materia } from '@/components/Materia';
import { RadarRapido } from '@/components/RadarRapido';
import { Encerramento } from '@/components/Encerramento';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; briefing: Briefing };

export function BriefingPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const url = date ? `/api/briefings/${date}` : '/api/briefings/latest';
    setState({ kind: 'loading' });

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error('Edição não encontrada.');
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const briefing = parseBriefing(json);
        // "/" resolves to the newest edition and settles on its permalink.
        if (!date) {
          navigate(`/briefing/${briefing.date}`, { replace: true });
          return;
        }
        setState({ kind: 'ready', briefing });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Não foi possível carregar a edição.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [date, navigate]);

  if (state.kind === 'loading') {
    return <div className="state-screen">Carregando o briefing…</div>;
  }
  if (state.kind === 'error') {
    return <div className="state-screen">{state.message}</div>;
  }
  return <BriefingView briefing={state.briefing} />;
}

function BriefingView({ briefing }: { briefing: Briefing }) {
  const articleRef = useRef<HTMLElement>(null);
  const [words, setWords] = useState(0);

  /** Read blocks in document order: the cover lede, then every paragraph. */
  const readBlocks = useMemo(() => {
    const list: string[] = [briefing.capa.sub];
    briefing.materias.forEach((m) => list.push(...m.paragrafos));
    return list;
  }, [briefing]);

  /** Global reading index of each matéria's first paragraph. */
  const offsets = useMemo(() => {
    let n = 1; // the cover lede occupies index 0
    return briefing.materias.map((m) => {
      const start = n;
      n += m.paragrafos.length;
      return start;
    });
  }, [briefing]);

  const speech = useSpeech(readBlocks);

  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const text = el.innerText || el.textContent || '';
    setWords(text.trim().split(/\s+/).filter(Boolean).length);
  }, [briefing]);

  useEffect(() => {
    document.title = `Briefing Diário — Arthur — ${new Date(
      briefing.date + 'T12:00:00'
    ).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }, [briefing.date]);

  return (
    <ReadingProvider
      value={{
        activeIndex: speech.activeIndex,
        playFrom: speech.playFrom,
        enabled: speech.supported,
      }}
    >
      <div className="briefing">
        <Masthead
          briefing={briefing}
          words={words}
          speech={speech}
          blockCount={readBlocks.length}
        />
        <SeuDia seuDia={briefing.seuDia} />

        <main ref={articleRef}>
          <Capa capa={briefing.capa} readIndex={0} />
          {briefing.materias.map((materia, i) => (
            <Materia key={materia.id} materia={materia} readIndexOffset={offsets[i]} />
          ))}
          <RadarRapido radar={briefing.radar} />
        </main>

        <Encerramento encerramento={briefing.encerramento} />
      </div>
    </ReadingProvider>
  );
}
