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
          // Variáveis: no claro escurecem para dar contraste sobre branco; no
          // escuro clareiam. São usados só como TEXTO (links e destaques).
          600: "rgb(var(--piquet-600) / <alpha-value>)",
          700: "rgb(var(--piquet-700) / <alpha-value>)",
          800: "#7E5208",
          900: "#533605",
        },
        // Semânticos quentes/terrosos do artefacto (base estático, .light troca no dark)
        success: { DEFAULT: "rgb(var(--success) / <alpha-value>)", light: "rgb(var(--success-light) / <alpha-value>)" },
        warning: { DEFAULT: "rgb(var(--warning) / <alpha-value>)", light: "rgb(var(--warning-light) / <alpha-value>)" },
        danger: { DEFAULT: "rgb(var(--danger) / <alpha-value>)", light: "rgb(var(--danger-light) / <alpha-value>)" },
        info: { DEFAULT: "rgb(var(--info) / <alpha-value>)", light: "rgb(var(--info-light) / <alpha-value>)" },
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
        // Sombra de cartão com profundidade suave (mais premium, ainda discreta).
        card: "0 1px 2px 0 rgb(28 26 23 / 0.04), 0 4px 12px -4px rgb(28 26 23 / 0.06)",
        elevated: "0 12px 32px -8px rgb(28 26 23 / 0.16), 0 4px 10px -3px rgb(28 26 23 / 0.08)",
      },
      borderRadius: {
        card: "16px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Open Sans", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
