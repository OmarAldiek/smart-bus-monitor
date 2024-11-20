/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0A3D62",
        secondary: "#3C6382",
        accent: "#38ADA9",
        warning: "#e55039",
        neutral: "#F8F9FA",
        card: "#FFFFFF",
      },
      fontFamily: {
        sans: ["Poppins", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 15px 35px rgba(10, 61, 98, 0.08)",
      },
    },
  },
  plugins: [],
};
