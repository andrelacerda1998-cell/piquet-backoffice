"use client";

import { useState, useEffect } from "react";
import { getAlerts } from "@/services/supportService";
import { contarPorRota } from "@/lib/navBadges";
import { useAuthStore } from "@/stores";

/**
 * Contadores das bolinhas do menu, a partir dos alertas reais.
 *
 * Uma leitura ao entrar e depois de 5 em 5 minutos. O menu vive na layout e
 * não volta a montar a cada navegação, por isso navegar não custa pedidos
 * nenhuns — mas quem deixa o backoffice aberto o dia todo também não fica com
 * números de manhã às cinco da tarde.
 *
 * Uma falha devolve zero bolinhas em silêncio: o menu é moldura, não é sítio
 * para mensagens de erro — quem quiser saber abre os Alertas, que dizem se
 * alguma fonte falhou.
 */
const INTERVALO_MS = 5 * 60 * 1000;

export function useNavBadges(): Record<string, number> {
  const [contas, setContas] = useState<Record<string, number>>({});
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) { setContas({}); return; }
    let vivo = true;
    const ler = async () => {
      try {
        const r = await getAlerts(1, 200);
        if (vivo) setContas(contarPorRota(r.data ?? []));
      } catch {
        if (vivo) setContas({});
      }
    };
    ler();
    const t = setInterval(ler, INTERVALO_MS);
    return () => { vivo = false; clearInterval(t); };
  }, [user]);

  return contas;
}
