import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { parseBriefing, type Briefing } from '@/types/briefing';
import { useAudioManifest, useNarration } from '@/hooks/useNarration';
import { materiaOffsets, readBlocksOf } from '@shared/readBlocks.js';
import { ReadingProvider } from '@/components/ReadBlock';
import { Masthead } from '@/components/Masthead';
import { SeuDia } from '@/components/SeuDia';
import { Capa } from '@/components/Capa';
import { Materia } from '@/components/Materia';
import { RadarRapido } from '@/components/RadarRapido';
import { Encerramento } from '@/components/Encerramento';
import { StickyPlayer } from '@/components/StickyPlayer';
import { EditionNav } from '@/components/EditionNav';
import { SectionRail, type RailItem } from '@/components/SectionRail';

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
  const playerRef = useRef<HTMLDivElement>(null);
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/briefings')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && Array.isArray(json.dates)) setDates(json.dates);
      })
      .catch(() => {
        /* navigation between editions is a bonus — the page works without it */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Shared with the audio generator so block N means the same thing on both sides.
  const readBlocks = useMemo(() => readBlocksOf(briefing), [briefing]);
  const offsets = useMemo(() => materiaOffsets(briefing), [briefing]);

  const railItems = useMemo<RailItem[]>(() => {
    const items: RailItem[] = [{ id: 'capa', label: 'Capa' }];
    briefing.materias.forEach((m) => items.push({ id: m.id, label: m.titulo }));
    if (briefing.radar.length) items.push({ id: 'radar', label: 'Radar rápido' });
    items.push({ id: 'encerramento', label: 'Para fechar o dia' });
    return items;
  }, [briefing]);

  const { manifest } = useAudioManifest(briefing.date);
  const speech = useNarration(readBlocks, manifest, `briefing:pos:${briefing.date}`);

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
        <StickyPlayer speech={speech} anchorRef={playerRef} />
        <SectionRail items={railItems} />

        <Masthead briefing={briefing} speech={speech} playerRef={playerRef} />
        <SeuDia seuDia={briefing.seuDia} />

        <main>
          <Capa capa={briefing.capa} readIndex={0} />
          {briefing.materias.map((materia, i) => (
            <Materia key={materia.id} materia={materia} readIndexOffset={offsets[i]} />
          ))}
          <RadarRapido radar={briefing.radar} />
        </main>

        <Encerramento encerramento={briefing.encerramento} />
        <EditionNav dates={dates} current={briefing.date} />
      </div>
    </ReadingProvider>
  );
}
