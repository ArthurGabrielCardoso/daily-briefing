import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaBlock, RadarItem } from '@/types/briefing';
import { SourceLine } from './SourceLine';
import { SvgArt } from './blocks';

function RadarThumb({ thumb }: { thumb: MediaBlock }) {
  switch (thumb.kind) {
    case 'photo':
      return (
        <div className="radar-thumb">
          <img src={thumb.src} alt={thumb.alt} loading="lazy" decoding="async" />
        </div>
      );
    case 'logo':
      return (
        <div className="radar-thumb logo-thumb">
          <img src={thumb.src} alt={thumb.alt} loading="lazy" decoding="async" />
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
            loading="lazy"
            decoding="async"
          />
        </div>
      );
  }
}

export function RadarRapido({ radar }: { radar: RadarItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure, radar]);

  const nudge = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: 'smooth' });
  };

  if (!radar.length) return null;

  return (
    <section className="radar">
      <div className="wrap">
        <div className="radar-head">
          <div className="eyebrow">Radar rápido</div>
          <div className="radar-nav">
            <button
              className="radar-arrow"
              onClick={() => nudge(-1)}
              disabled={!edges.left}
              aria-label="Ver cartões anteriores"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M15 5l-7 7 7 7z" />
              </svg>
            </button>
            <button
              className="radar-arrow"
              onClick={() => nudge(1)}
              disabled={!edges.right}
              aria-label="Ver mais cartões"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 5l7 7-7 7z" />
              </svg>
            </button>
          </div>
        </div>

        <div
          className={`radar-scroll-wrap${edges.left ? ' fade-left' : ''}${
            edges.right ? ' fade-right' : ''
          }`}
        >
          <div className="radar-scroll" ref={scrollRef}>
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
      </div>
    </section>
  );
}
