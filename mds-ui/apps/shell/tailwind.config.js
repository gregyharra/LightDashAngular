/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./apps/shell/src/**/*.{html,ts}', './libs/**/*.{html,ts}'],
  theme: {
    extend: {},
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
