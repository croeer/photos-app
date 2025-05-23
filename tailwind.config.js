/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cadbury: "#482683",
      },
      fontFamily: {
        custom: ["'Great Vibes'", "cursive"], // Use the font here
      },
    },
  },
  plugins: [],
};
