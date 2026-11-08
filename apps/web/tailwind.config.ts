import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: '#080C14',
          50: '#F0F4FA',
          100: '#D9E2EC',
          200: '#BCCCDC',
          300: '#9FB3C8',
          400: '#829AB1',
          500: '#627D98',
          600: '#486581',
          700: '#334E68',
          800: '#1E293B',
          850: '#162032',
          900: '#0F172A',
          950: '#06090F',
          surface: '#0E1422',
          card: '#121A2D',
          border: '#1F2C44',
          muted: '#18233A',
        },
        brand: {
          cyan: '#06B6D4',
          emerald: '#10B981',
          violet: '#8B5CF6',
        },
        background: '#080C14',
        foreground: '#F8FAFC',
        card: {
          DEFAULT: '#0E1422',
          foreground: '#F8FAFC',
        },
        popover: {
          DEFAULT: '#0E1422',
          foreground: '#F8FAFC',
        },
        primary: {
          DEFAULT: '#06B6D4',
          foreground: '#080C14',
        },
        secondary: {
          DEFAULT: '#1E293B',
          foreground: '#F8FAFC',
        },
        muted: {
          DEFAULT: '#18233A',
          foreground: '#94A3B8',
        },
        accent: {
          DEFAULT: '#10B981',
          foreground: '#080C14',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#F8FAFC',
        },
        border: '#1F2C44',
        input: '#1F2C44',
        ring: '#06B6D4',
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      boxShadow: {
        'obsidian-glow': '0 0 25px -5px rgba(6, 182, 212, 0.25)',
        'obsidian-card': '0 10px 30px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(31, 44, 68, 0.8)',
        'obsidian-badge': '0 0 15px -3px rgba(16, 185, 129, 0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
