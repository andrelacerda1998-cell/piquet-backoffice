/**
 * O funil da app do cliente (Mixpanel), em português.
 *
 * Os passos chegam como eventos do Mixpanel ("service_viewed"). Aqui ganham um
 * nome que se lê e uma explicação do que a pessoa fez, tirada do código da app
 * (repositório app-costumer, outubro de 2026). Quando um evento só acontece a
 * parte das pessoas, diz-se quem fica de fora: o funil do Mixpanel exige todos
 * os passos, por ordem, e quem salta um sai do funil mesmo que peça e pague.
 */

export interface PassoDoFunil {
  nome: string;
  explicacao: string;
  /** Quem chega lá por outro caminho e não fica registado neste passo. */
  foraDoFunil?: string;
}

const PASSOS: Record<string, PassoDoFunil> = {
  app_opened: {
    nome: "Abriu a app",
    explicacao: "Abriu a app do cliente e chegou à página inicial.",
  },
  category_viewed: {
    nome: "Entrou numa categoria",
    explicacao: "Tocou numa categoria da página inicial (Canalização, Eletricidade…).",
    foraDoFunil: "Quem abre um serviço pelos populares ou pela pesquisa salta este passo e sai do funil aqui.",
  },
  service_viewed: {
    nome: "Abriu um serviço",
    explicacao: "Tocou num serviço da categoria e viu o detalhe, com o preço «a partir de».",
  },
  guest_address_submitted: {
    nome: "Indicou a morada",
    explicacao: "Escreveu a morada do serviço, numa zona onde a Piquet trabalha. Fora das zonas, a app avisa e não conta aqui.",
    foraDoFunil: "Só se regista em quem pede sem conta: quem já tem conta escolhe a morada noutro ecrã.",
  },
  technician_list_viewed: {
    nome: "Viu técnicos disponíveis",
    explicacao: "Apareceu pelo menos um técnico para aquele serviço e aquela morada.",
    foraDoFunil: "Sem técnicos disponíveis não se regista: uma quebra aqui também é falta de oferta (ver Mercado). O cesto, com vários serviços, não regista este passo.",
  },
  technician_selected: {
    nome: "Escolheu um técnico",
    explicacao: "Tocou num técnico da lista para seguir para o pagamento ou para a marcação.",
    foraDoFunil: "O cesto, com vários serviços, não regista este passo.",
  },
  sms_verified: {
    nome: "Confirmou o telemóvel",
    explicacao: "Escreveu o código que recebeu por SMS.",
    foraDoFunil: "Só quem pede sem conta, ou quem entra na conta nesse momento. Quem já tem sessão iniciada não passa por aqui.",
  },
  checkout_started: {
    nome: "Abriu o pagamento",
    explicacao: "Chegou ao ecrã de pagamento, com o preço já calculado.",
  },
  checkout_input_filled: {
    nome: "Escolheu como pagar",
    explicacao: "Escolheu o método de pagamento (MB WAY, cartão, Apple Pay…) ou preencheu o NIF ou um código de desconto.",
    foraDoFunil: "Quem já tem o método escolhido e só carrega em «Pagar» não se regista aqui.",
  },
  service_confirmed: {
    nome: "Confirmou o pedido",
    explicacao: "O pagamento foi aceite e o pedido ficou feito. É a conversão.",
  },
};

/** O passo em português; um evento que ainda não se conhece mostra-se pelo nome, legível. */
export function passoDoFunil(evento: string): PassoDoFunil {
  const conhecido = PASSOS[evento];
  if (conhecido) return conhecido;
  const legivel = evento.replace(/[_-]+/g, " ").trim();
  return {
    nome: legivel ? legivel.charAt(0).toUpperCase() + legivel.slice(1) : "Passo sem nome",
    explicacao: `Evento «${evento}» do Mixpanel, ainda sem explicação aqui.`,
  };
}

export interface AvisoDoFunil {
  tom: "atencao" | "info";
  texto: string;
}

/**
 * O que, na definição do funil, faz perder pessoas que avançaram na app.
 * Depende só dos eventos e da ordem: se o funil mudar no Mixpanel, os avisos
 * mudam com ele.
 */
export function avisosDoFunil(eventos: string[]): AvisoDoFunil[] {
  const pos = (e: string) => eventos.indexOf(e);
  const avisos: AvisoDoFunil[] = [];
  if (pos("sms_verified") >= 0 && pos("checkout_started") > pos("sms_verified")) {
    avisos.push({
      tom: "atencao",
      texto:
        "«Confirmou o telemóvel» está antes de «Abriu o pagamento», mas na app é ao contrário: quem pede sem conta recebe o código já dentro do pagamento. " +
        "Com esta ordem, quase ninguém passa de um passo para o outro, e a quebra aí é do funil, não das pessoas. " +
        "Corrige-se no Mixpanel, trocando a ordem destes dois passos.",
    });
  }
  if (pos("guest_address_submitted") >= 0 || pos("sms_verified") >= 0) {
    avisos.push({
      tom: "info",
      texto:
        "Este funil segue sobretudo quem pede sem conta: «Indicou a morada» e «Confirmou o telemóvel» só acontecem a convidados. " +
        "Quem já tem conta salta esses passos e sai do funil, mesmo que peça e pague.",
    });
  }
  return avisos;
}

export interface MaiorQuebra {
  /** Índice do passo onde se chega (a quebra é entre `indice - 1` e `indice`). */
  indice: number;
  perdidos: number;
  /** 0–1, face ao passo anterior. */
  fracao: number;
}

/** Onde se perdem mais PESSOAS (em número, não em percentagem: 1 em 2 não é notícia). */
export function maiorQuebra(contagens: number[]): MaiorQuebra | null {
  let melhor: MaiorQuebra | null = null;
  for (let i = 1; i < contagens.length; i++) {
    const antes = contagens[i - 1];
    const perdidos = antes - contagens[i];
    if (antes <= 0 || perdidos <= 0) continue;
    if (!melhor || perdidos > melhor.perdidos) melhor = { indice: i, perdidos, fracao: perdidos / antes };
  }
  return melhor;
}

/** "45 s", "3 min", "2 h", "4 dias" — o tempo médio entre dois passos. */
export function duracaoCurta(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 90) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 90) return `${min} min`;
  const h = Math.round(s / 3600);
  if (h < 36) return `${h} h`;
  const dias = Math.round(s / 86400);
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}
