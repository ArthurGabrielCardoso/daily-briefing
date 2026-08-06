import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "6 de agosto de 2026" */
export function formatLongDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "Quinta-feira" */
export function weekdayOf(date: string): string {
  const raw = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
