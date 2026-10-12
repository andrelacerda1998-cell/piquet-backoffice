"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/formatters";
import { toast } from "@/stores";
import { getNotas, escreverNota, type EntidadeDaNota, type NotaInterna } from "@/services/notasService";

/**
 * As notas internas de um pedido, cliente ou técnico: o que a equipa sabe e
 * não está no Laravel ("remarcado para amanhã de manhã"). Cada nota fica com
 * quem a escreveu e quando, e não se edita nem se apaga.
 *
 * `focar` abre logo com o cursor na caixa (vindo de "+ Novo › Nota").
 */
export function NotasInternas({ entidade, id, focar = false }: { entidade: EntidadeDaNota; id: string; focar?: boolean }) {
  const [notas, setNotas] = useState<NotaInterna[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => {
    let vivo = true;
    setNotas(null);
    getNotas(entidade, id)
      .then((n) => vivo && setNotas(n))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível ler as notas."));
    return () => { vivo = false; };
  }, [entidade, id]);

  const guardar = async () => {
    const t = texto.trim();
    if (!t) return;
    setAGuardar(true);
    try {
      const nova = await escreverNota(entidade, id, t);
      setNotas((n) => [nova, ...(n ?? [])]);
      setTexto("");
      toast("Nota guardada.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível guardar a nota.", "error");
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void guardar(); } }}
          rows={2}
          maxLength={2000}
          autoFocus={focar}
          placeholder="Ex.: cliente pediu para remarcar para amanhã de manhã"
          className="input-field text-sm resize-y w-full"
          aria-label="Nova nota interna"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-text-muted">Só a equipa vê. Fica com o teu nome e não se apaga.</p>
          <button onClick={guardar} disabled={!texto.trim() || aGuardar} className="btn-primary text-xs py-1.5 disabled:opacity-40">
            {aGuardar ? "A guardar…" : "Guardar nota"}
          </button>
        </div>
      </div>
      {erro ? <p className="text-sm text-danger">{erro}</p>
        : notas === null ? <p className="text-sm text-text-muted">A carregar…</p>
        : notas.length === 0 ? <p className="text-sm text-text-muted">Ainda sem notas.</p>
        : (
          <ul className="divide-y divide-surface-border">
            {notas.map((n) => (
              <li key={n.id} className="py-2">
                <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{n.texto}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{n.autor} · {formatDateTime(n.criadoEm)}</p>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
