import { Fragment } from 'react';
import type { Block, Materia as MateriaType, Tag } from '@/types/briefing';
import { blocksAfter, blocksIn } from '@/types/briefing';
import { useReveal } from '@/hooks/useReveal';
import { ReadBlock } from './ReadBlock';
import { SourceLine } from './SourceLine';
import {
  BarChart,
  ConceptBox,
  EditorialImage,
  MegaNumber,
  StatCard,
  SvgHero,
  VideoEmbed,
} from './blocks';

const TAG_LABELS: Record<Tag, string> = {
  essencial: 'Essencial',
  importante: 'Importante',
  acompanhar: 'Para acompanhar',
  curiosidade: 'Curiosidade',
};

function renderBlock(block: Block, key: number) {
  switch (block.kind) {
    case 'megaNumber':
      return <MegaNumber key={key} numero={block.numero} label={block.label} de={block.de} />;
    case 'statCard':
      return <StatCard key={key} numero={block.numero} label={block.label} />;
    case 'conceptBox':
      return <ConceptBox key={key} termo={block.termo} texto={block.texto} />;
    case 'editorialImage': {
      const isTop = (block.slot ?? 'inline') === 'top';
      return (
        <Fragment key={key}>
          <EditorialImage
            src={block.src}
            alt={block.alt}
            caption={block.caption}
            style={
              isTop
                ? { height: block.height, margin: '20px 0 4px' }
                : { height: block.height }
            }
          />
          {block.marginBottom ? <div style={{ marginBottom: block.marginBottom }} /> : null}
        </Fragment>
      );
    }
    case 'svgHero':
      return <SvgHero key={key} name={block.name} legenda={block.legenda} />;
    case 'videoEmbed':
      return (
        <VideoEmbed
          key={key}
          youtubeId={block.youtubeId}
          start={block.start}
          legenda={block.legenda}
        />
      );
    case 'barChart':
      return <BarChart key={key} rows={block.rows} nota={block.nota} />;
  }
}

const READ_HINT = (
  <div className="rb-hint">
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
    toque em qualquer parágrafo pra ouvir a partir dali
  </div>
);

interface MateriaProps {
  materia: MateriaType;
  /** Global reading index of this matéria's first paragraph. */
  readIndexOffset: number;
}

export function Materia({ materia, readIndexOffset }: MateriaProps) {
  const { tag, variant, titulo, paragrafos, blocks, readHint, fonte } = materia;
  const reveal = useReveal<HTMLElement>();

  const isDark = variant === 'dark-number' || variant === 'dark-chart';
  const isTwoCol = variant !== 'dark-number';
  // "image-video" closes with the video, so its source line sits below the grid.
  const sourceAtBottom = variant === 'image-video';

  const topBlocks = blocksIn(blocks, 'top');
  const asideBlocks = blocksIn(blocks, 'aside');
  const bottomBlocks = blocksIn(blocks, 'bottom');

  const body = (
    <div className="materia-body">
      {blocksAfter(blocks, -1).map((b, i) => renderBlock(b, i))}
      {paragrafos.map((texto, i) => (
        <Fragment key={i}>
          <ReadBlock index={readIndexOffset + i}>{texto}</ReadBlock>
          {blocksAfter(blocks, i).map((b, j) => renderBlock(b, (i + 1) * 100 + j))}
        </Fragment>
      ))}
      {readHint ? READ_HINT : null}
      {sourceAtBottom ? null : <SourceLine fonte={fonte} />}
    </div>
  );

  const aside =
    asideBlocks.length === 1
      ? renderBlock(asideBlocks[0], 0)
      : asideBlocks.length > 1
        ? <div>{asideBlocks.map((b, i) => renderBlock(b, i))}</div>
        : null;

  return (
    <article
      id={materia.id}
      ref={reveal}
      className={isDark ? 'materia materia-dark reveal' : 'materia reveal'}
    >
      <div className="wrap">
        <div className="materia-card">
        <div className="materia-head">
          <span className={`tag tag-${tag}`}>{TAG_LABELS[tag]}</span>
          <h2 className="materia-title">{titulo}</h2>
        </div>

        {topBlocks.map((b, i) => renderBlock(b, i))}

        {isTwoCol ? (
          <div className="materia-2col">
            {body}
            {aside}
          </div>
        ) : (
          body
        )}

        {bottomBlocks.map((b, i) => renderBlock(b, i))}
        {sourceAtBottom ? <SourceLine fonte={fonte} /> : null}
        </div>
      </div>
    </article>
  );
}
