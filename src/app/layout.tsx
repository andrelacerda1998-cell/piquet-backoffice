import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Piquet — Área de administração",
  description: "Backoffice de gestão da Piquet — serviços ao domicílio",
  /*
    Instalável no ecrã inicial. No iOS estas três são obrigatórias e o
    manifest é ignorado: sem `appleWebApp`, "Adicionar ao ecrã principal"
    cria um atalho do Safari em vez de uma app -- e sem app não há Web Push.
  */
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    /*
      É este o nome do ícone no ecrã inicial, e é o que o iOS mostra como
      origem das notificações ("... de Piquet Gestão").

      "Piquet" seria ambíguo: a app dos clientes já se chama assim, e ficavam
      duas iguais no mesmo telemóvel. Mesma razão por que o ícone é diferente.

      O iOS lê isto no momento em que se adiciona ao ecrã inicial, e deixa
      editar o campo -- por isso um nome antigo escrito à mão ganha a este.
    */
    title: "Piquet Gestão",
    /*
      `default` e NAO `black-translucent`.
      
      Translucida, a barra de estado fica transparente com texto BRANCO --
      por cima do tema claro (#FFFFFF) o relogio e a bateria desapareciam.
      E, sendo transparente, o conteudo passava-lhe por baixo: era isso que
      fazia o topo do ecra parecer desalinhado em modo app.
    */
    /*
      `black` desde que o escuro passou a ser o defeito.

      `default` pinta a barra de estado de BRANCO, e por cima de uma app
      escura era uma faixa clara no topo -- o mesmo desalinhamento que já se
      tinha corrigido, mas ao contrário. `black` fica bem nos dois temas:
      uma barra preta sobre o tema claro é o que metade das apps do telemóvel
      faz.

      Isto é lido no momento em que se instala no ecrã inicial: só muda
      depois de remover e voltar a adicionar.
    */
    statusBarStyle: "black",
  },
  /*
    O Next emite `mobile-web-app-capable`, que é o nome atual. O iOS mais
    antigo só conhece o prefixado -- e é ele que decide se "Adicionar ao ecrã
    principal" cria uma app ou um atalho do Safari. Sem app não há Web Push,
    por isso vão os dois.
  */
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    apple: "/icones/apple-touch-icon.png",
    icon: [
      { url: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

/* `viewport-fit=cover` para o conteúdo passar por baixo do entalhe. */
export const viewport: Viewport = {
  /*
    Um valor só, e escuro. As variantes por `prefers-color-scheme` seguiam o
    tema do TELEMÓVEL, e o backoffice não segue o telemóvel -- tem tema
    próprio, agora escuro por omissão. Com o telemóvel em claro e a app em
    escuro, a barra ficava clara por cima de um ecrã escuro.
  */
  themeColor: "#1C1A17",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/*
  Corre antes de o browser pintar, para não haver um clarão branco antes de o
  React arrancar. Agora o escuro é o DEFEITO: só se tira a classe a quem
  escolheu o claro, em vez de só se pôr a quem escolheu o escuro. Se o
  localStorage estiver inacessível (janela privada), fica escuro -- que é o
  que o resto da app assume.
*/
const themeScript = `(function(){try{var t=JSON.parse(localStorage.getItem('piquet-theme'));var m=t&&t.state&&t.state.theme;if(m!=='light')document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={openSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
