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
        // Backed by CSS custom properties (see index.css) that swap value
        // under .dark — every existing bg-ink-*/text-ink-*/border-ink-*
        // usage across the app inverts automatically, without touching
        // each component individually.
        ink: {
          50: "rgb(var(--ink-50) / <alpha-value>)",
          100: "rgb(var(--ink-100) / <alpha-value>)",
          200: "rgb(var(--ink-200) / <alpha-value>)",
          300: "rgb(var(--ink-300) / <alpha-value>)",
          400: "rgb(var(--ink-400) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
        },
        // Card/panel/input background — white in light mode, a dark slate
        // surface in dark mode. Distinct from `ink` because most bg-white
        // usages in the app mean "the surface a card sits on", not a step
        // on the neutral text/border scale.
        surface: "rgb(var(--surface) / <alpha-value>)",
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
