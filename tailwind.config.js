/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./preview/**/*.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0a1a3a',
          light: '#122a5c',
          50: '#e8edf5',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      }
    }
  }
}
