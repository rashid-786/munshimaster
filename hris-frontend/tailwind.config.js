/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef4f8',
          100: '#d5e4ef',
          200: '#abc8db',
          300: '#7ca9c4',
          400: '#4d8bb0',
          500: '#2b6d96',
          600: '#0B3C5D',
          700: '#09304a',
          800: '#072437',
          900: '#051c2b',
        },
        secondary: {
          50: '#e8fbf0',
          100: '#c5f4d8',
          200: '#9eedbe',
          300: '#70e29e',
          400: '#4ad485',
          500: '#2FBF71',
          600: '#25a05e',
          700: '#1e814a',
          800: '#176338',
          900: '#0f4526',
        },
      },
    },
  },
  plugins: [],
}
