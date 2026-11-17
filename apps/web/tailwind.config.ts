import type { Config } from 'tailwindcss';

/** InfluenceHub design tokens — deep navy, warm white, champagne gold. */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1rem', md: '1.5rem', lg: '2rem' }, screens: { '2xl': '1280px' } },
    extend: {
      colors: {
        navy: { 950: '#060F1E', 900: '#0B1B33', 800: '#13284A', 700: '#1D3761', 600: '#2A4A7C', 100: '#E7ECF4', 50: '#F3F6FA' },
        gold: { 700: '#8C6D2E', 600: '#A8874A', 500: '#C8A96A', 400: '#D7BE8C', 200: '#EEE2C8', 100: '#F7F0E2' },
        ivory: { DEFAULT: '#FAF8F4', 100: '#F6F3EC', 200: '#EFEBE2' },
        stone: { 50: '#F7F6F3', 100: '#EFEEEA', 200: '#E2E0DA', 300: '#CBC8C0', 400: '#A29E95', 500: '#7C786F', 600: '#5E5A52', 700: '#45423C', 800: '#2E2C28' },
        success: '#2F7D5B',
        warning: '#B7791F',
        danger: '#B4423A',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'var(--font-arabic)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-arabic)', 'Georgia', 'serif'],
      },
      borderRadius: { DEFAULT: '6px', md: '8px', lg: '10px', xl: '14px' },
      boxShadow: {
        soft: '0 1px 2px rgba(11,27,51,0.04), 0 4px 16px rgba(11,27,51,0.06)',
        lift: '0 2px 4px rgba(11,27,51,0.05), 0 12px 32px rgba(11,27,51,0.10)',
      },
      backgroundImage: {
        'navy-sheen': 'linear-gradient(135deg, #0B1B33 0%, #13284A 55%, #1D3761 100%)',
        'gold-line': 'linear-gradient(90deg, transparent, #C8A96A, transparent)',
      },
    },
  },
  plugins: [],
} satisfies Config;
