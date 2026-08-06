import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: [],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0B1E3D',
        navy2: '#14294E',
        petrol: '#0E3D46',
        gold: '#B8935A',
        'gold-br': '#D9B26E',
        'bg-warm': '#FAF6EF',
        card: '#FFFFFF',
        ink: '#1C1B18',
        'ink-soft': '#5B5850',
        'ink-faint': '#9A968C',
        hairline: '#E7E1D4',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        lg: '12px',
        md: '10px',
        sm: '6px',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
