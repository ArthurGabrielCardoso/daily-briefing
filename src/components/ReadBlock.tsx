import { createContext, useContext, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ReadingContextValue {
  activeIndex: number;
  playFrom: (index: number) => void;
  enabled: boolean;
}

const ReadingContext = createContext<ReadingContextValue>({
  activeIndex: -1,
  playFrom: () => {},
  enabled: false,
});

export const ReadingProvider = ReadingContext.Provider;
export const useReading = () => useContext(ReadingContext);

interface ReadBlockProps {
  /** Position of this block in the document-order reading sequence. */
  index: number;
  as?: 'p' | 'div';
  className?: string;
  children: React.ReactNode;
}

/**
 * A paragraph that can be clicked to start narration from that point, and that
 * highlights + scrolls itself into view while it is being read.
 */
export function ReadBlock({ index, as: Tag = 'p', className, children }: ReadBlockProps) {
  const { activeIndex, playFrom, enabled } = useReading();
  const ref = useRef<HTMLParagraphElement & HTMLDivElement>(null);
  const active = activeIndex === index;

  useEffect(() => {
    if (!active || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [active]);

  return (
    <Tag
      ref={ref}
      className={cn('rb', active && 'rb-active', className)}
      onClick={() => enabled && playFrom(index)}
    >
      {children}
    </Tag>
  );
}
