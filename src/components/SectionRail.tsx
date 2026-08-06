import { useMemo } from 'react';
import { useScrollSpy } from '@/hooks/useReveal';

export interface RailItem {
  id: string;
  label: string;
}

/**
 * Long-read navigation: one dot per section, the current one lit. Desktop only —
 * it is a shortcut, not a requirement, so small screens simply scroll.
 */
export function SectionRail({ items }: { items: RailItem[] }) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const active = useScrollSpy(ids);

  if (items.length < 2) return null;

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="rail" aria-label="Seções da edição">
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button
              className={item.id === active ? 'rail-dot is-active' : 'rail-dot'}
              onClick={() => go(item.id)}
              aria-current={item.id === active ? 'true' : undefined}
            >
              <span className="rail-label">{item.label}</span>
              <span className="rail-mark" aria-hidden="true" />
              <span className="sr-only">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
