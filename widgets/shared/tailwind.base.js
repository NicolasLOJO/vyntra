/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../shared/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vyn: {
          glass: "rgba(255, 255, 255, 0.03)",
          border: "rgba(255, 255, 255, 0.12)",
          accent: "#7ca8ff",
        },
      },
      backdropBlur: {
        vyn: "40px",
      },
      borderRadius: {
        vyn: "24px",
      },
      backgroundImage: {
        "vyn-liquid": "linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03))",
      },
    },
  },
  plugins: [],
};
