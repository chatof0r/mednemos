/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette de marque — deux thèmes, trois couleurs.
        // Clair : fond bleu, contours/accents blancs.
        // Sombre : fond gris foncé, contours/accents bleus.
        // Le texte reste blanc ("ink") dans les deux modes.
        brand: 'rgb(9 12 214 / <alpha-value>)',      // #090cd6
        charcoal: 'rgb(32 32 32 / <alpha-value>)',   // #202020
        ink: 'rgb(243 243 243 / <alpha-value>)',     // #f3f3f3
      },
    },
  },
  plugins: [],
};
