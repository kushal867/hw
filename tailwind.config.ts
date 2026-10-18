import type { Config } from "tailwindcss";

// Design tokens live in globals.css as CSS variables; Tailwind maps to them.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)", 100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)", 300: "rgb(var(--brand-300) / <alpha-value>)", 500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)", 700: "rgb(var(--brand-700) / <alpha-value>)",
        },
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
      },
      fontFamily: { sans: ["var(--font-sans)", "Noto Sans Devanagari", "system-ui", "sans-serif"] },
      borderRadius: { card: "16px", control: "12px" },
      boxShadow: { card: "0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.05)", pop: "0 14px 32px -10px rgb(79 70 229 / 0.22), 0 4px 12px rgb(16 24 40 / 0.06)" },
    },
  },
  plugins: [],
};
export default config;
