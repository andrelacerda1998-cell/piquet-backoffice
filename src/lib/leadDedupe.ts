/**
 * Regras de anti-duplicação de leads da landing.
 *
 * O formulário dispara o POST mais do que uma vez (submit + click-to-chat,
 * duplo toque, voltar atrás e reenviar). A primeira versão só considerava
 * duplicado quando a mensagem era EXATAMENTE igual — e deixou passar um par
 * real: duas leads do mesmo telefone no mesmo minuto, uma com
 * "Servico: Outro" e outra com "Servico: Selecionar…". Basta o utilizador
 * mexer no dropdown entre os dois envios para as mensagens diferirem.
 *
 * Duas janelas, portanto:
 * - mesma mensagem + mesmo contacto → 30 min (reenvio do mesmo pedido);
 * - só o mesmo contacto → 10 min (reenvio com o formulário alterado).
 *
 * A janela curta é deliberadamente curta: a mesma pessoa pode pedir dois
 * serviços diferentes de propósito, e isso são duas leads legítimas.
 */
export const JANELA_MESMA_MENSAGEM_MIN = 30;
export const JANELA_MESMO_CONTACTO_MIN = 10;

export interface LeadExistente {
  created_at: string;
  message?: string | null;
}

/**
 * @param existentes leads recentes do MESMO contacto (telefone/email/nome)
 * @param mensagem   mensagem da lead a inserir
 * @param agoraMs    instante de referência
 */
export function eDuplicado(
  existentes: LeadExistente[],
  mensagem: string,
  agoraMs: number,
): boolean {
  const idadeMin = (iso: string) => (agoraMs - Date.parse(iso)) / 60000;
  return existentes.some((e) => {
    const idade = idadeMin(e.created_at);
    if (idade < 0) return false; // registo no futuro: ignora, não bloqueia
    if ((e.message ?? "") === mensagem) return idade <= JANELA_MESMA_MENSAGEM_MIN;
    return idade <= JANELA_MESMO_CONTACTO_MIN;
  });
}
