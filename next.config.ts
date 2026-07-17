import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Páginas fundidas na simplificação de 2026-07-17 — URLs antigos redirecionam
  // para o destino que absorveu o conteúdo (links guardados não partem).
  async redirects() {
    const toConfig = ["/definicoes", "/catalogo", "/precos", "/zonas", "/categorias-zonas"];
    return [
      ...toConfig.map((source) => ({ source, destination: "/configuracao", permanent: false })),
      { source: "/produto-suporte", destination: "/produto", permanent: false },
    ];
  },
};

export default nextConfig;
