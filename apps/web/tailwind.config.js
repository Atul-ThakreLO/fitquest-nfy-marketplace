/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        rarity: {
          common:    '#9CA3AF',
          rare:      '#60A5FA',
          epic:      '#A78BFA',
          legendary: '#FCD34D',
          mythic:    '#F97316',
        },
        surface: {
          DEFAULT: '#0f0f12',
          '1': '#17171d',
          '2': '#1e1e27',
          '3': '#26263a',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(249,115,22,0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(249,115,22,0.6)' },
        },
      },
    },
  },
  plugins: [],
}
