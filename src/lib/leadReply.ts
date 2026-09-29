/**
 * Mensagem automática de boas-vindas a uma lead — texto e extração de dados.
 *
 * Puro (sem rede nem segredos) para poder ser usado tanto no webhook do
 * WhatsApp (envio automático quando a lead chega) como no backoffice (botão
 * "Inserir modelo"). Ter um só sítio garante que o texto é sempre o mesmo.
 */

export interface DadosLead {
  nome?: string;
  servico?: string;
  localizacao?: string;
  /** "Urgente (hoje ou amanhã)" / "Normal (próximos dias)" — como o cliente escolheu. */
  urgencia?: string;
}

/**
 * Extrai nome/serviço/localização do texto do pedido. Cobre os dois formatos:
 * o do formulário da landing entregue por WhatsApp (`*Nome:* …`, `*Serviço:* …`,
 * `*Localização:* …`) e o "Serviço: X · Urgência: Y". Campos ausentes vêm "".
 */
export function extrairDadosLead(message: string, fallbackNome = ""): Required<DadosLead> {
  const m = message || "";
  const pick = (re: RegExp) => m.match(re)?.[1]?.trim() ?? "";
  // Os dois-pontos são OBRIGATÓRIOS — senão "Novo pedido de serviço — Site
  // Piquet" (o título) seria apanhado como o serviço.
  const nome = pick(/\*?\s*nome\s*:\*?\s*([^\n*]+)/i) || fallbackNome;
  const servico = pick(/\*?\s*servi[çc]o\s*:\*?\s*([^\n*·]+)/i);
  const localizacao = pick(/\*?\s*(?:localiza[çc][ãa]o|cidade|localidade)\s*:\*?\s*([^\n*]+)/i);
  // A urgência decide quem vale a pena incomodar e com que pressa; ia perdida
  // porque só o ecrã a lia, e quem a precisa é quem despacha.
  const urgencia = pick(/\*?\s*urg[êe]ncia\s*:\*?\s*([^\n*·]+)/i);
  return {
    nome: nome.trim(), servico: servico.trim(),
    localizacao: localizacao.trim(), urgencia: urgencia.trim(),
  };
}

/** Primeiro nome, para o tratamento pessoal. */
export function primeiroNome(nome: string): string {
  return (nome || "").trim().split(/\s+/)[0] || "";
}

/**
 * A mensagem veio do formulário de pedido da landing (piquetapp.com)?
 * Reconhece-se pelo marcador do formulário ("Novo pedido de serviço — Site
 * Piquet" / "piquetapp.com") mais pelo menos um campo estruturado. É o gatilho
 * da resposta automática — um "olá" solto não a dispara.
 */
export function eFormularioLanding(message: string): boolean {
  const m = (message || "").toLowerCase();
  const temMarcador =
    m.includes("piquetapp.com") ||
    m.includes("novo pedido de serviço") ||
    m.includes("novo pedido de servico");
  const temCampo = /\*?\s*(nome|servi[çc]o)\s*:/i.test(message || "");
  return temMarcador && temCampo;
}

/**
 * A mensagem genérica de resposta. Os campos em falta são omitidos com
 * elegância — nunca deixa "[Serviço]" ou "[Localização]" no texto.
 */
export function mensagemBoasVindas({ nome, servico, localizacao }: DadosLead): string {
  const primeiro = primeiroNome(nome ?? "");
  const saudacao = primeiro ? `Olá, ${primeiro}.` : "Olá.";
  const loc = (localizacao ?? "").trim();
  const serv = (servico ?? "").trim();
  const pedido = serv
    ? `o seu pedido de ${serv}${loc ? ` em ${loc}` : ""}`
    : `o seu pedido${loc ? ` em ${loc}` : ""}`;
  return [
    saudacao,
    "",
    "Obrigado pelo seu contacto com a Piquet.",
    "",
    `Recebemos ${pedido} e já estamos a verificar a disponibilidade de um técnico para o ajudar.`,
    "",
    "Entraremos em contacto consigo assim que tivermos disponibilidade confirmada.",
    "",
    "Obrigado,",
    "",
    "Equipa Piquet",
  ].join("\n");
}

/**
 * O contacto ESCRITO no formulário, que pode não ser o de quem envia.
 *
 * A mensagem que a landing prepara traz "*Contacto:* 912345678". Quem carrega
 * em enviar pode estar noutro telemóvel -- preencheu no computador e enviou do
 * telefone de outra pessoa, ou pôs o contacto de um familiar. Sem ler este
 * campo, o mesmo pedido entrava duas vezes: uma pelo formulário, outra pela
 * mensagem, com números diferentes e sem forma de as juntar.
 *
 * Devolve "" quando a mensagem não traz o campo.
 */
export function contactoNoFormulario(message: string): string {
  const m = (message || "").match(/\*?\s*contacto\s*:\*?\s*([+0-9 ()-]{9,})/i)?.[1] ?? "";
  return m.replace(/[^0-9]/g, "");
}
