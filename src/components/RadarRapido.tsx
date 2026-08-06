import type { MediaBlock, RadarItem } from '@/types/briefing';
import { SourceLine } from './SourceLine';
import { SvgArt } from './blocks';

function RadarThumb({ thumb }: { thumb: MediaBlock }) {
  switch (thumb.kind) {
    case 'photo':
      return (
        <div className="radar-thumb">
          <img src={thumb.src} alt={thumb.alt} />
        </div>
      );
    case 'logo':
      return (
        <div className="radar-thumb logo-thumb">
          <img src={thumb.src} alt={thumb.alt} />
        </div>
      );
    case 'svg':
      return (
        <div className="radar-thumb vector-thumb">
          <SvgArt name={thumb.name} variant="thumb" />
        </div>
      );
    case 'video':
      return (
        <div className="radar-thumb">
          <img
            src={`https://i.ytimg.com/vi/${thumb.youtubeId}/hqdefault.jpg`}
            alt={thumb.legenda}
          />
        </div>
      );
  }
}

export function RadarRapido({ radar }: { radar: RadarItem[] }) {
  if (!radar.length) return null;
  return (
    <section className="radar">
      <div className="wrap">
        <div className="eyebrow">Radar rápido</div>
        <div className="radar-scroll">
          {radar.map((item, i) => (
            <div className="radar-card" key={i}>
              <RadarThumb thumb={item.thumb} />
              <div className="radar-body">
                <div className="radar-cat">{item.categoria}</div>
                <div className="radar-title">{item.titulo}</div>
                <div className="radar-text">{item.texto}</div>
                <SourceLine fonte={item.fonte} compact />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
