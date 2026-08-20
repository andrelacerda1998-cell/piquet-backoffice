/**
 * Deteta o erro do Postgres/PostgREST para "esta coluna não existe".
 *
 * Serve para o backoffice continuar a funcionar quando o código já usa uma
 * coluna nova mas a migração ainda não foi aplicada à base de dados. Sem isto,
 * acrescentar um campo parte TODAS as edições do CRM — não só a do campo novo —
 * porque o UPDATE inteiro é rejeitado.
 *
 * `42703` é o SQLSTATE `undefined_column`; `PGRST204` é o equivalente do
 * PostgREST quando a coluna não está no seu esquema em cache.
 */
export function isMissingColumn(erro: unknown, coluna: string): boolean {
  if (!erro || typeof erro !== "object") return false;
  const e = erro as { code?: string; message?: string };
  const code = e.code ?? "";
  const msg = (e.message ?? "").toLowerCase();
  if (code !== "42703" && code !== "PGRST204") return false;
  return msg.includes(coluna.toLowerCase());
}
