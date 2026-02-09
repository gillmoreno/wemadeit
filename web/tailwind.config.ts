import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', 'Palatino', 'serif'],
        body: ['Avenir Next', 'Segoe UI', 'Helvetica Neue', 'sans-serif']
      },
      colors: {
        sand: {
          50: '#fef8f2',
          100: '#faecde',
          200: '#f3d9bd',
          300: '#e9c29a',
          400: '#dc9f68',
          500: '#cf8445',
          600: '#bb6b37',
          700: '#9b542f',
          800: '#7d4530',
          900: '#653a2a'
        },
        stoneink: '#1f1a16'
      },
      keyframes: {
        enter: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        enter: 'enter 450ms ease-out both'
      },
      boxShadow: {
        soft: '0 18px 40px rgba(81, 54, 32, 0.10)'
      }
    }
  },
  plugins: []
};

export default config;

