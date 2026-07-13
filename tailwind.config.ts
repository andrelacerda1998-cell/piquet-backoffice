import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Dourado da marca (tom do artefacto: #FAB347)
        piquet: {
          DEFAULT: "#FAB347",
          50: "#FEF6E9",
          100: "#FDECCF",
          200: "#FBD99C",
          300: "#FAC873",
          400: "#FAB347",
          500: "#E39A1C",
          600: "#C67E0F",
          700: "#A96C0A",
          800: "#7E5208",
          900: "#533605",
        },
        // Semânticos quentes/terrosos do artefacto (base estático, .light troca no dark)
        success: { DEFAULT: "#1F9D6B", light: "rgb(var(--success-light) / <alpha-value>)" },
        warning: { DEFAULT: "#E39A1C", light: "rgb(var(--warning-light) / <alpha-value>)" },
        danger: { DEFAULT: "#D6503B", light: "rgb(var(--danger-light) / <alpha-value>)" },
        info: { DEFAULT: "#3E7C8C", light: "rgb(var(--info-light) / <alpha-value>)" },
        // Superfícies e texto — variáveis (claro: creme, escuro: castanho profundo)
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          muted: "rgb(var(--surface-muted) / <alpha-value>)",
          subtle: "rgb(var(--surface-subtle) / <alpha-value>)",
          border: "rgb(var(--surface-border) / <alpha-value>)",
          strong: "rgb(var(--surface-strong) / <alpha-value>)",
        },
        text: {
          primary: "rgb(var(--text-primary) / <alpha-value>)",
          secondary: "rgb(var(--text-secondary) / <alpha-value>)",
          muted: "rgb(var(--text-muted) / <alpha-value>)",
        },
        // Sidebar / superfícies escuras
        ink: {
          DEFAULT: "#1C1A17",
          deep: "#141109",
          soft: "#272219",
          border: "#3D362A",
          muted: "#8C8477",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(28 26 23 / 0.05), 0 1px 3px 0 rgb(28 26 23 / 0.06)",
        elevated: "0 8px 24px -6px rgb(28 26 23 / 0.14), 0 2px 6px -2px rgb(28 26 23 / 0.08)",
      },
      borderRadius: {
        card: "14px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
