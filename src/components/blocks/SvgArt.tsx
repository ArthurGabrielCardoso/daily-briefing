import type { SvgName } from '@/types/briefing';

/**
 * Inline editorial illustrations. `hero` fills its container (the .svg-hero
 * frame sizes it), `thumb` keeps the intrinsic size used in radar cards.
 */
export function SvgArt({ name, variant }: { name: SvgName; variant: 'hero' | 'thumb' }) {
  if (name === 'perimetro') {
    return (
      <svg
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
        {...(variant === 'thumb' ? { width: 120, height: 120 } : {})}
      >
        <rect
          x="60"
          y="60"
          width="280"
          height="280"
          rx="18"
          fill="none"
          stroke="#3A4E72"
          strokeWidth="2"
          strokeDasharray="6 8"
        />
        <circle cx="130" cy="140" r="7" fill="#4A5D82" />
        <circle cx="190" cy="110" r="7" fill="#4A5D82" />
        <circle cx="230" cy="180" r="7" fill="#4A5D82" />
        <circle cx="150" cy="230" r="7" fill="#4A5D82" />
        <circle cx="260" cy="260" r="7" fill="#4A5D82" />
        <circle cx="100" cy="280" r="7" fill="#4A5D82" />
        <path
          d="M 230 180 C 270 210, 320 250, 372 300"
          fill="none"
          stroke="#D9B26E"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="372" cy="300" r="9" fill="#D9B26E" />
        <circle cx="372" cy="300" r="16" fill="none" stroke="#D9B26E" strokeWidth="1.5" opacity="0.5" />
      </svg>
    );
  }

  if (name === 'bars') {
    return (
      <svg width="80" height="52" viewBox="0 0 80 52" fill="none">
        <rect x="4" y="30" width="10" height="18" rx="2" fill="#D9B26E" opacity="0.55" />
        <rect x="20" y="20" width="10" height="28" rx="2" fill="#D9B26E" opacity="0.7" />
        <rect x="36" y="10" width="10" height="38" rx="2" fill="#D9B26E" opacity="0.85" />
        <rect x="52" y="2" width="10" height="46" rx="2" fill="#D9B26E" />
        <rect x="68" y="16" width="10" height="32" rx="2" fill="#D9B26E" opacity="0.75" />
      </svg>
    );
  }

  return (
    <svg width="90" height="52" viewBox="0 0 90 52" fill="none">
      <path
        d="M2 40 C 18 42, 28 20, 44 24 C 60 28, 68 8, 88 6"
        stroke="#D9B26E"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="88" cy="6" r="4" fill="#D9B26E" />
    </svg>
  );
}

/** The small terrain sparkline in the "Seu dia" strip. */
export function TerrainSvg() {
  return (
    <svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" width="100%">
      <path
        d="M 0 42 C 30 41, 60 43, 90 41 C 120 40, 150 42, 180 41 C 200 40, 210 41, 220 40"
        fill="none"
        stroke="#5B5850"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="46" cy="20" r="6" fill="none" stroke="#B8935A" strokeWidth="1.6" />
    </svg>
  );
}
