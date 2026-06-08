import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        'rt-go': '#5DCAA5',
        'rt-rust': '#FAC775',
        'rt-bun': '#F4C0D1',
        'rt-node': '#AFA9EC',
        'rt-python': '#ED93B1',
        'rt-php': '#7F77DD'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      animation: {
        'pulse-health': 'pulse-health 2s ease-in-out infinite'
      },
      keyframes: {
        'pulse-health': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.15)' }
        }
      }
    }
  },
  plugins: []
} as Config;
