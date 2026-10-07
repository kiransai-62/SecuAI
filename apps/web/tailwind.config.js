/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#05070c',
          surface: '#090d15',
          card: '#0f1420',
          cardHover: '#141b2c',
          emerald: '#10b981',
          cyan: '#06b6d4',
          amber: '#f59e0b',
          crimson: '#f43f5e',
          violet: '#8b5cf6',
          border: 'rgba(255, 255, 255, 0.08)',
          borderHover: 'rgba(255, 255, 255, 0.16)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
