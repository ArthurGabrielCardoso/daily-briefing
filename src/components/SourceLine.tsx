import type { Fonte } from '@/types/briefing';

interface SourceLineProps {
  fonte: Fonte;
  /** Radar cards drop the "Ler matéria original" wording. */
  compact?: boolean;
}

export function SourceLine({ fonte, compact }: SourceLineProps) {
  return (
    <div className="source-line">
      Fonte:{' '}
      <a href={fonte.url} target="_blank" rel="noopener">
        {fonte.nome}
      </a>{' '}
      {compact ? '↗' : '· Ler matéria original ↗'}
    </div>
  );
}
