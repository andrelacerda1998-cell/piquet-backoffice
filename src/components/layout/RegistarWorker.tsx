"use client";

import { useEffect } from "react";
import { registarWorker } from "@/lib/pushCliente";

/**
 * Regista o service worker assim que o backoffice abre.
 *
 * Estava só dentro do painel das notificações, em Configurações: quem nunca
 * abrisse aquele separador nunca teria worker — e um `sw.js` novo só chegava
 * a quem lá voltasse. Registar no arranque também é o que faz uma correção ao
 * worker propagar-se sozinha.
 *
 * Não pede autorização nenhuma: registar é silencioso, e a pergunta continua
 * a ser feita só quando a pessoa carrega no botão.
 */
export function RegistarWorker() {
  useEffect(() => {
    registarWorker();
  }, []);

  return null;
}
