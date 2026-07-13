import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0D1B2A',
          50:  '#E8EDF2',
          100: '#C5D0DC',
          200: '#9FAFC0',
          300: '#798FA4',
          400: '#567390',
          500: '#3A5A77',
          600: '#2A4560',
          700: '#1C3249',
          800: '#122133',
          900: '#0D1B2A',
        },
        teal: {
          DEFAULT: '#4EC6C6',
          50:  '#EBF9F9',
          100: '#C5EEEE',
          200: '#9DE4E4',
          300: '#75D9D9',
          400: '#4EC6C6',
          500: '#35ADAD',
          600: '#278686',
          700: '#1A6060',
          800: '#0E3D3D',
          900: '#071E1E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'sans-serif'],
        condensed: ['Barlow Condensed', 'Arial Narrow', 'sans-serif'],
      },
      backgroundImage: {
        'navy-gradient': 'linear-gradient(135deg, #0D1B2A 0%, #122133 50%, #1C3249 100%)',
        'card-gradient': 'linear-gradient(145deg, #152238 0%, #0D2035 50%, #0A1A2E 100%)',
      },
    },
  },
  plugins: [],
}

export default config
