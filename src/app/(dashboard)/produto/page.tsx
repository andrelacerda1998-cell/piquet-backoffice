import { redirect } from "next/navigation";

/**
 * O Produto é um separador de Crescimento (12/10/2026), e as Integrações
 * passaram para Configurações › Sistema. Os endereços antigos continuam a
 * levar ao sítio certo (`?tab=funil` → o funil, `?tab=integracoes` → Sistema).
 */
export default async function ProdutoPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  if (tab === "integracoes") redirect("/configuracao?tab=sistema");
  redirect(tab ? `/crescimento?tab=produto&vista=${encodeURIComponent(tab)}` : "/crescimento?tab=produto");
}
