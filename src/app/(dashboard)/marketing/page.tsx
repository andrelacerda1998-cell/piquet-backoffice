import { redirect } from "next/navigation";

/**
 * O Marketing é um separador de Crescimento (12/10/2026). Este endereço continua
 * a funcionar. O antigo "CRM & Leads" (`?tab=crm`, para onde apontam os avisos
 * antigos do sino) vive agora em Contactos.
 */
export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  redirect(tab === "crm" ? "/leads" : "/crescimento?tab=marketing");
}
