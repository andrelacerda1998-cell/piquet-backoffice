import { describe, it, expect } from "vitest";
import { comIntervalos, textoDoEvento, type EventoDoPedido } from "./historicoPedido";

const ev = (p: Partial<EventoDoPedido>): EventoDoPedido => ({ tipo: "estado", de: null, para: null, vendor_id: null, vendor_name: null, dados: null, em: "2026-10-08T10:00:00Z", ...p });

describe("textoDoEvento", () => {
  it("estados com o nome do backoffice e de onde vieram", () => {
    expect(textoDoEvento(ev({ de: "Matching", para: "Accepted", deBackoffice: "a_procurar_tecnico", paraBackoffice: "tecnico_encontrado" })))
      .toEqual({ titulo: "Técnico encontrado", detalhe: "antes: A procurar técnico" });
  });

  it("um estado que o backoffice não conhece mostra o nome cru, em vez de nada", () => {
    expect(textoDoEvento(ev({ para: "EstadoNovo", paraBackoffice: null })).titulo).toBe("EstadoNovo");
  });

  it("convites com a onda e a distância; respostas por extenso", () => {
    expect(textoDoEvento(ev({ tipo: "convidado", vendor_name: "Rui", dados: { onda: 2, distancia_km: 4.5 } })))
      .toEqual({ titulo: "Rui foi convidado", detalhe: "onda 2 · 4,5 km" });
    expect(textoDoEvento(ev({ tipo: "resposta", vendor_name: "Rui", para: "expired" })).titulo).toBe("Rui não respondeu a tempo");
    expect(textoDoEvento(ev({ tipo: "resposta", vendor_id: 7, para: "lost" })).titulo).toBe("Técnico 7 aceitou, mas o cliente escolheu outro");
  });
});

describe("comIntervalos", () => {
  it("ordena e diz quanto passou desde o passo anterior", () => {
    const r = comIntervalos([ev({ em: "2026-10-08T10:02:00Z" }), ev({ em: "2026-10-08T10:00:00Z" })]);
    expect(r.map((x) => x.segundosDesdeAnterior)).toEqual([null, 120]);
  });
});
