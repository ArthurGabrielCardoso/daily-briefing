import type { Briefing } from '@/types/briefing';
import { TerrainSvg } from './blocks';

export function SeuDia({ seuDia }: { seuDia: Briefing['seuDia'] }) {
  return (
    <div className="seu-dia">
      <div className="wrap">
        <div className="seu-dia-text">
          <div className="seu-dia-label">Seu dia</div>
          <div className="seu-dia-line">{seuDia.agenda}</div>
          {seuDia.alerta ? <div className="seu-dia-alert">{seuDia.alerta}</div> : null}
        </div>
        <div className="seu-dia-terrain">
          <TerrainSvg />
        </div>
      </div>
    </div>
  );
}
