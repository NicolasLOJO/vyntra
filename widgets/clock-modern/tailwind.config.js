import baseConfig from "../shared/tailwind.base.js";

/** @type {import('tailwindcss').Config} */
export default {
  ...baseConfig,
  content: [
    ...baseConfig.content,
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
};
