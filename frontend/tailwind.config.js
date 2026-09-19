/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        },
        archimate: {
          strategy: '#f3c483',
          business: '#ffff99',
          application: '#b5ffff',
          technology: '#c9e7b7',
          physical: '#95d08b',
          motivation: '#ccccff',
          implementation: '#ffe0e0'
        }
      }
    },
  },
  plugins: [],
}
