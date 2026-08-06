import type { Briefing } from '@/types/briefing';
import { ReadBlock } from './ReadBlock';
import { SourceLine } from './SourceLine';
import { EditorialImage, SvgArt, SvgHero, VideoEmbed } from './blocks';

interface CapaProps {
  capa: Briefing['capa'];
  readIndex: number;
}

function CapaMedia({ media }: { media: Briefing['capa']['media'] }) {
  switch (media.kind) {
    case 'svg':
      return <SvgHero name={media.name} legenda={media.legenda} className="capa-media" />;
    case 'photo':
      return (
        <EditorialImage
          src={media.src}
          alt={media.alt}
          caption={{ text: media.credito }}
          style={{ height: '100%', minHeight: 340 }}
        />
      );
    case 'logo':
      return (
        <div className="svg-hero capa-media">
          <img src={media.src} alt={media.alt} />
        </div>
      );
    case 'video':
      return (
        <div className="capa-media">
          <VideoEmbed
            youtubeId={media.youtubeId}
            start={media.start}
            legenda={media.legenda}
          />
        </div>
      );
  }
}

export function Capa({ capa, readIndex }: CapaProps) {
  return (
    <section className="capa">
      <div className="wrap capa-grid">
        <div>
          <div className="eyebrow">{capa.eyebrow}</div>
          <h1 className="capa-headline">{capa.headline}</h1>
          <ReadBlock index={readIndex} className="capa-sub">
            {capa.sub}
          </ReadBlock>
          <p className="capa-frase">{capa.frase}</p>
          <SourceLine fonte={capa.fonte} />
        </div>
        <CapaMedia media={capa.media} />
      </div>
    </section>
  );
}

export { SvgArt };
