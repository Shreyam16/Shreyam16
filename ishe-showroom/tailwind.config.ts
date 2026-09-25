import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0d0d0d',
        bone: '#fbf9f3',
        paper: '#ffffff',
        stone: '#e9e5dc',
        mist: '#8a8780',
        brass: '#b08d57',
      },
      fontFamily: {
        display: ['"Bodoni Moda"', 'Didot', 'serif'],
        editorial: ['"Cormorant Garamond"', 'Garamond', 'serif'],
        ui: ['Jost', 'Futura', 'sans-serif'],
      },
      letterSpacing: { plaque: '0.32em' },
    },
  },
  plugins: [],
};
export default config;
