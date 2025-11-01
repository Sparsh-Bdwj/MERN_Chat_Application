/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          500: "#7C3AED", // violet-500
          600: "#6D28D9", // violet-600
        },
      },
    },
  },
  plugins: [],
};
