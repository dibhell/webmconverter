/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
      },
      colors: {
        'midnight-pine': '#1F2A2E',
        'frozen-spruce': '#2E3F43',
        'cold-shadow-blue': '#344B5A',
        'steel-winter': '#4A5E6A',
        'old-wood': '#3B322B',
        'charcoal-bark': '#2B2622',
        'deep-forest-teal': '#223A3A',
        'icy-slate': '#5C6F78',
        'frost': '#E7ECEB',
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
