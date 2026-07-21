/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
        display: ['"Manrope"', '"Inter"', "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0efff",
          200: "#b9dcff",
          300: "#7fbfff",
          400: "#3d9dff",
          500: "#0f7fff",
          600: "#0062db",
          700: "#004db1",
          800: "#003d8a",
          900: "#002e69",
        },
        ink: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)",
        pop: "0 10px 40px -8px rgba(15,23,42,0.18)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
