import type { MetadataRoute } from "next";

/**
 * O backoffice como aplicação instalável.
 *
 * A alternativa era uma app nativa: já existiu uma (piquet_admin, Flutter, 26
 * ecrãs) e morreu em dez semanas — manter uma segunda superfície para duas
 * pessoas custa mais do que rende, e este mês, em que metade dos ecrãs foi
 * reescrita, teria sido feito duas vezes.
 *
 * O que falta mesmo não é outro ecrã: é ser avisado. A Estela espera há dez
 * dias e não foi por falta de ecrã, foi por falta de aviso. Instalada, esta
 * página pode receber notificações push — que é a única coisa que o browser
 * não dava.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Piquet — Gestão",
    /*
      O `short_name` é o que o Android põe por baixo do ícone. "Piquet"
      confundia-se com a app dos clientes; aqui cabem os dois nomes.
    */
    short_name: "Piquet Gestão",
    description: "Backoffice da Piquet: serviços, técnicos, suporte e dinheiro.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-PT",
    /*
      Fundo escuro nos dois: é a cor do ecrã de arranque e da barra de
      estado. Com o dourado da marca, o texto branco do sistema ficava
      ilegível por cima.
    */
    background_color: "#1C1A17",
    theme_color: "#1C1A17",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
      /*
        `maskable` é o que o Android recorta em círculo. Sem uma versão
        própria, ele recorta a normal e come os cantos do desenho.
      */
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    /*
      Atalhos: aparecem ao manter o ícone premido. São os dois sítios onde
      alguém está à espera de resposta.
    */
    shortcuts: [
      { name: "Suporte", short_name: "Suporte", url: "/suporte" },
      { name: "Pedidos", short_name: "Pedidos", url: "/leads" },
    ],
  };
}
