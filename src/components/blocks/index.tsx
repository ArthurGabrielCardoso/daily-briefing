import type { Caption, SvgName } from '@/types/briefing';
import { SvgArt } from './SvgArt';

export { SvgArt, TerrainSvg } from './SvgArt';

/** Oversized figure with its unit label — the anchor of the "dark-number" variant. */
export function MegaNumber({
  numero,
  label,
  de,
}: {
  numero: string;
  label: string;
  de?: string;
}) {
  return (
    <div className="number-hero">
      <div>
        <div className="big-number">{numero}</div>
        <div className="big-number-label">{label}</div>
      </div>
      {de ? <div className="number-hero-of">{de}</div> : null}
    </div>
  );
}

export function StatCard({ numero, label }: { numero: string; label: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card-num">{numero}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

/** Glossary aside: a bolded term followed by its plain-language definition. */
export function ConceptBox({ termo, texto }: { termo: string; texto: string }) {
  return (
    <div className="concept-box">
      <b>{termo}</b> {texto}
    </div>
  );
}

function CaptionText({ caption }: { caption: Caption }) {
  return (
    <>
      {caption.strong ? <b>{caption.strong}</b> : null}
      {caption.text}
    </>
  );
}

export function EditorialImage({
  src,
  alt,
  caption,
  style,
}: {
  src: string;
  alt: string;
  caption: Caption;
  style?: React.CSSProperties;
}) {
  return (
    <div className="editorial-img" style={style}>
      <img src={src} alt={alt} />
      <div className="cap">
        <CaptionText caption={caption} />
      </div>
    </div>
  );
}

export function SvgHero({
  name,
  legenda,
  className,
}: {
  name: SvgName;
  legenda?: string;
  className?: string;
}) {
  return (
    <div className={className ? `svg-hero ${className}` : 'svg-hero'}>
      <SvgArt name={name} variant="hero" />
      {legenda ? <div className="cap">{legenda}</div> : null}
    </div>
  );
}

export function VideoEmbed({
  youtubeId,
  start,
  legenda,
}: {
  youtubeId: string;
  start?: number;
  legenda: string;
}) {
  const src = `https://www.youtube.com/embed/${youtubeId}${start ? `?start=${start}` : ''}`;
  return (
    <>
      <div className="video-embed">
        <iframe src={src} title={legenda} allowFullScreen loading="lazy" />
      </div>
      <div className="video-cap">{legenda}</div>
    </>
  );
}

export function BarChart({
  rows,
  nota,
}: {
  rows: { label: string; valor: number; texto: string; cor: string }[];
  nota?: string;
}) {
  return (
    <div className="bar-chart">
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <div className="bar-label">{row.label}</div>
          <div className="bar-track">
            <div className={`bar-fill ${row.cor}`} style={{ width: `${row.valor}%` }}>
              <span>{row.texto}</span>
            </div>
          </div>
        </div>
      ))}
      {nota ? <div className="bar-chart-note">{nota}</div> : null}
    </div>
  );
}
