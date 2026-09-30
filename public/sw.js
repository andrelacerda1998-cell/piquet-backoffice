/*
  Service worker do backoffice.

  Faz duas coisas, e só duas:

  1. Recebe notificações push e mostra-as.
  2. Ao tocar numa, abre o ecrã certo — reutilizando a janela já aberta em vez
     de abrir outra, que é o que faz parecer que a app "duplicou".

  NÃO faz cache de nada, de propósito. Um backoffice que serve páginas
  guardadas mostra números antigos com ar de atuais — foi contra isso que
  passámos o mês. Sem rede, é melhor dizer que não há rede.
*/

self.addEventListener("install", () => {
  // Entra em serviço sem esperar que as abas antigas fechem.
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    // Push sem JSON válido: mostra-se o que houver em texto, em vez de
    // engolir a notificação e deixar quem a mandou a pensar que chegou.
    dados = { titulo: "Piquet", corpo: evento.data ? evento.data.text() : "" };
  }

  const titulo = dados.titulo || "Piquet";
  const opcoes = {
    body: dados.corpo || "",
    icon: "/icones/icone-192.png",
    badge: "/icones/icone-192.png",
    /*
      `tag` junta notificações do mesmo assunto numa só. Sem isto, cinco
      tickets novos dão cinco avisos empilhados e o telemóvel vibra cinco
      vezes — a maneira mais rápida de alguém desligar as notificações.
    */
    tag: dados.tag || undefined,
    renotify: Boolean(dados.tag),
    data: { url: dados.url || "/" },
    // Vibra: no telemóvel, um aviso que não se sente não serve de aviso.
    vibrate: [80, 40, 80],
  };

  evento.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || "/";

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      // Já há uma janela do backoffice aberta? Leva-se essa ao destino.
      for (const janela of janelas) {
        if (janela.url.includes(self.location.origin) && "focus" in janela) {
          janela.navigate(destino).catch(() => {});
          return janela.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
