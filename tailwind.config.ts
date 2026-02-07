import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        scada: {
          bg: '#0a0a0f',
          'bg-secondary': '#12121a',
          card: '#1a1a25',
          'card-hover': '#22222f',
          accent: '#00d4aa',
          'accent-dim': 'rgba(0, 212, 170, 0.15)',
          warning: '#ffaa00',
          'warning-dim': 'rgba(255, 170, 0, 0.15)',
          danger: '#ff4757',
          'danger-dim': 'rgba(255, 71, 87, 0.15)',
          cold: '#4a9eff',
          'cold-dim': 'rgba(74, 158, 255, 0.15)',
          border: '#2a2a3a',
          'text-secondary': '#8888aa',
          'text-muted': '#555566',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'bubble-rise': {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '0.7' },
          '100%': { transform: 'translateY(-60px) scale(0.3)', opacity: '0' },
        },
        'flow-dash': {
          '0%': { strokeDashoffset: '20' },
          '100%': { strokeDashoffset: '0' },
        },
        'pump-rotate': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'heat-glow': {
          '0%, 100%': { filter: 'drop-shadow(0 0 4px rgba(255, 71, 87, 0.8))' },
          '50%': { filter: 'drop-shadow(0 0 12px rgba(255, 71, 87, 1))' },
        },
        'cool-glow': {
          '0%, 100%': { filter: 'drop-shadow(0 0 4px rgba(74, 158, 255, 0.8))' },
          '50%': { filter: 'drop-shadow(0 0 12px rgba(74, 158, 255, 1))' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'bubble-rise': 'bubble-rise 3s ease-out infinite',
        'flow-dash': 'flow-dash 1s linear infinite',
        'pump-rotate': 'pump-rotate 1s linear infinite',
        'heat-glow': 'heat-glow 1.5s ease-in-out infinite',
        'cool-glow': 'cool-glow 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
