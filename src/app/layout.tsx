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
    title: "Piquet",
    // A barra de estado fica escura como o resto da aplicação.
    statusBarStyle: "black-translucent",
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

/*
  `viewport-fit=cover` para o conteúdo passar por baixo do entalhe, e
  `themeColor` para a barra de estado acompanhar o tema em vez de ficar um
  rectângulo branco por cima de um ecrã escuro.
*/
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF8F5" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1A17" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeScript = `(function(){try{var t=JSON.parse(localStorage.getItem('piquet-theme'));var m=t&&t.state&&t.state.theme;if(m==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

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
