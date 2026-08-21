import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    /**
     * Fuso fixo em UTC — o mesmo do CI (ubuntu-latest) e o mesmo da Vercel.
     *
     * Sem isto, quem desenvolve em Lisboa corre os testes noutro fuso e o
     * resultado pode divergir do CI: aconteceu mesmo, com 4 testes de datas a
     * passar no Mac e a falhar no GitHub, deixando o CI vermelho vários
     * commits seguidos sem que ninguém reparasse.
     *
     * As funções de negócio continuam a trabalhar em Europe/Lisbon (ver
     * src/lib/periodo.ts) e os testes verificam-no explicitamente — fixar o
     * fuso do PROCESSO não esconde erros de fuso, só torna as corridas iguais
     * em todo o lado.
     */
    env: { TZ: "UTC" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
