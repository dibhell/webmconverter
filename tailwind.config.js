/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./components/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
      },
      colors: {
        'midnight-pine': '#0F0F10',
        'frozen-spruce': '#403E4C',
        'cold-shadow-blue': '#615D64',
        'steel-winter': '#95918E',
        'old-wood': '#C1B9A8',
        'charcoal-bark': '#080808',
        'deep-forest-teal': '#686068',
        'icy-slate': '#888888',
        'frost': '#F4F4F1',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
