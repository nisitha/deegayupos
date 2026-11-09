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
        pos: {
          canvas: '#F8FAFC',
          surface: '#FFFFFF',
          primary: '#005BD3',
          'primary-hover': '#004CB5',
          border: '#E2E8F0',
          'border-light': '#F1F5F9',
          text: '#0F172A',
          muted: '#64748B',
          emerald: '#10B981',
          'emerald-bg': '#ECFDF5',
          'emerald-text': '#065F46',
          amber: '#F59E0B',
          'amber-bg': '#FFFBEB',
          'amber-text': '#92400E',
          rose: '#EF4444',
          'rose-bg': '#FEF2F2',
          'rose-text': '#991B1B',
          blue: '#005BD3',
          'blue-bg': '#EFF6FF',
          'blue-text': '#004CB5',
        },
        background: '#F8FAFC',
        foreground: '#0F172A',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F172A',
        },
        primary: {
          DEFAULT: '#005BD3',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#F1F5F9',
          foreground: '#0F172A',
        },
        muted: {
          DEFAULT: '#F8FAFC',
          foreground: '#64748B',
        },
        accent: {
          DEFAULT: '#2F65F6',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        border: '#E2E8F0',
        input: '#E2E8F0',
        ring: '#2F65F6',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.03), 0 1px 2px -1px rgba(15, 23, 42, 0.03)',
        'card-hover': '0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.03)',
        rail: '-4px 0 24px 0 rgba(15, 23, 42, 0.03)',
        'pos-card': '0 10px 30px -5px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
        'pos-card-hover': '0 14px 35px -5px rgba(0, 91, 211, 0.08), 0 6px 10px -2px rgba(0, 0, 0, 0.03)',
        'pos-btn': '0 4px 14px 0 rgba(0, 91, 211, 0.25)',
        'pos-subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px 0 rgba(0, 0, 0, 0.02)',
      },
    },
  },
  plugins: [],
};

export default config;
