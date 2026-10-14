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
        danger: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
          light: "rgb(var(--danger-light) / <alpha-value>)",
          // Para texto POR CIMA de `bg-danger` — segue o tema, como o vermelho.
          on: "rgb(var(--on-danger) / <alpha-value>)",
        },
        info: { DEFAULT: "rgb(var(--info) / <alpha-value>)", light: "rgb(var(--info-light) / <alpha-value>)" },
        // Superfícies e texto — variáveis (claro: papel quente, escuro: grafite)
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          muted: "rgb(var(--surface-muted) / <alpha-value>)",
          subtle: "rgb(var(--surface-subtle) / <alpha-value>)",
          border: "rgb(var(--surface-border) / <alpha-value>)",
          strong: "rgb(var(--surface-strong) / <alpha-value>)",
          // A barra lateral: um degrau ao lado da página, nos dois temas.
          sidebar: "rgb(var(--surface-sidebar) / <alpha-value>)",
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
          // Vermelho das bolinhas da barra lateral. Fixo de propósito: a barra
          // é sempre escura, não segue o tema, por isso não pode usar o
          // `danger` do tema — no claro esse tom é escurecido para se ler sobre
          // branco e, sobre a barra preta, uma bolinha escura não se vê.
          alert: "#D6503B",
        },
      },
      boxShadow: {
        // Variáveis: no claro, uma sombra curta que separa o cartão do papel;
        // no escuro não há sombra que se veja -- o contorno faz esse trabalho.
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
      },
      borderRadius: {
        card: "12px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
