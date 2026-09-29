"use client";

import { useState } from "react";
import Image from "next/image";
import { Modal, Field } from "@/components/ui/Modal";
import { useAsyncData } from "@/hooks/useDashboard";
import {
  getAdsOptions, criarCampanhaMeta, criarConjuntoMeta, carregarImagemMeta,
  criarCriativoMeta, criarAnuncioMeta, mudarEstadoMeta,
} from "@/services/marketingService";
import { toast } from "@/stores";
import { cn } from "@/lib/utils";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Criação de anúncios da Meta a partir do backoffice.
 *
 * Os quatro passos são os da própria Marketing API — campanha → conjunto →
 * criativo → anúncio — e não uma invenção nossa: cada um é um objeto
 * separado, criado por uma chamada distinta, e um erro no terceiro não desfaz
 * os dois primeiros. Por isso o assistente mostra o que já foi criado e deixa
 * retomar, em vez de fingir uma transação que a API não tem.
 *
 * TUDO nasce em pausa. Activar é um botão à parte, no fim, depois de o
 * anúncio existir e poder ser visto no Ads Manager.
 */

const CTAS = [
  { id: "LEARN_MORE", label: "Saber mais" },
  { id: "SIGN_UP", label: "Registar" },
  { id: "BOOK_TRAVEL", label: "Marcar" },
  { id: "CONTACT_US", label: "Contactar" },
  { id: "DOWNLOAD", label: "Descarregar" },
] as const;

type Passo = 1 | 2 | 3 | 4;

export function CriarAnuncio({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: opcoes, loading, refetch } = useAsyncData(() => getAdsOptions(), []);
  const [passo, setPasso] = useState<Passo>(1);
  const [aGravar, setAGravar] = useState(false);

  // Ids do que já foi criado nesta sessão do assistente.
  const [campanhaId, setCampanhaId] = useState("");
  const [conjuntoId, setConjuntoId] = useState("");
  const [criativoId, setCriativoId] = useState("");
  const [anuncioId, setAnuncioId] = useState("");

  // Passo 1 — campanha
  const [novaCampanha, setNovaCampanha] = useState(true);
  const [campNome, setCampNome] = useState("");
  const [campObjetivo, setCampObjetivo] = useState("OUTCOME_LEADS");
  const [campOrcamento, setCampOrcamento] = useState("");

  // Passo 2 — conjunto
  const [novoConjunto, setNovoConjunto] = useState(true);
  const [conjNome, setConjNome] = useState("");
  const [conjOrcamento, setConjOrcamento] = useState("");
  const [idadeMin, setIdadeMin] = useState("18");
  const [idadeMax, setIdadeMax] = useState("65");

  // Passo 3 — criativo
  const [paginaId, setPaginaId] = useState("");
  const [imagem, setImagem] = useState<{ hash: string; url: string } | null>(null);
  const [texto, setTexto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [link, setLink] = useState("https://piquetapp.com");
  const [cta, setCta] = useState<string>("LEARN_MORE");

  const fechar = () => {
    setPasso(1);
    setCampanhaId(""); setConjuntoId(""); setCriativoId(""); setAnuncioId("");
    setImagem(null);
    onClose();
  };

  const erro = (e: unknown) => toast(e instanceof Error ? e.message : "Erro.", "error");

  const gravarCampanha = async () => {
    setAGravar(true);
    try {
      if (novaCampanha) {
        const r = await criarCampanhaMeta({
          nome: campNome, objetivo: campObjetivo,
          orcamentoDiario: campOrcamento ? Number(campOrcamento) : undefined,
        });
        setCampanhaId(r.id);
        toast("Campanha criada em pausa.");
        refetch();
      }
      setPasso(2);
    } catch (e) { erro(e); } finally { setAGravar(false); }
  };

  const gravarConjunto = async () => {
    setAGravar(true);
    try {
      if (novoConjunto) {
        const r = await criarConjuntoMeta({
          campanhaId, nome: conjNome,
          orcamentoDiario: conjOrcamento ? Number(conjOrcamento) : undefined,
          idadeMin: Number(idadeMin), idadeMax: Number(idadeMax),
        });
        setConjuntoId(r.id);
        toast("Conjunto criado em pausa.");
        refetch();
      }
      setPasso(3);
    } catch (e) { erro(e); } finally { setAGravar(false); }
  };

  const enviarImagem = async (f: File) => {
    setAGravar(true);
    try {
      setImagem(await carregarImagemMeta(f));
      toast("Imagem carregada.");
    } catch (e) { erro(e); } finally { setAGravar(false); }
  };

  const gravarCriativoEAnuncio = async () => {
    if (!imagem) return;
    setAGravar(true);
    try {
      const c = await criarCriativoMeta({
        paginaId, imagemHash: imagem.hash, texto, titulo, link, cta,
        nome: campNome || conjNome || undefined,
      });
      setCriativoId(c.id);
      const a = await criarAnuncioMeta({ conjuntoId, criativoId: c.id, nome: titulo || campNome || undefined });
      setAnuncioId(a.id);
      toast("Anúncio criado — está em pausa.");
      setPasso(4);
    } catch (e) { erro(e); } finally { setAGravar(false); }
  };

  const activar = async () => {
    setAGravar(true);
    try {
      // Os três têm de estar activos para o anúncio correr: um anúncio activo
      // dentro de um conjunto em pausa não entrega nada.
      for (const id of [campanhaId, conjuntoId, anuncioId].filter(Boolean)) {
        await mudarEstadoMeta(id, "ACTIVE");
      }
      toast("Anúncio activado. Começa a gastar orçamento assim que a Meta o aprovar.", "success");
      fechar();
    } catch (e) { erro(e); } finally { setAGravar(false); }
  };

  const paginas = opcoes?.pages ?? [];
  const campanhas = opcoes?.campaigns ?? [];
  const conjuntos = (opcoes?.adsets ?? []).filter((a) => !campanhaId || a.campaign_id === campanhaId);

  const passos: { n: Passo; label: string }[] = [
    { n: 1, label: "Campanha" }, { n: 2, label: "Conjunto" },
    { n: 3, label: "Criativo" }, { n: 4, label: "Rever" },
  ];

  return (
    <Modal
      open={open}
      onClose={fechar}
      size="full"
      title="Criar anúncio na Meta"
      subtitle="Campanha → conjunto → criativo → anúncio. Tudo é criado em pausa."
      footer={<button onClick={fechar} className="btn-secondary text-sm">Fechar</button>}
    >
      <div className="space-y-5">
        {/* Estado da ligação — o erro mais provável é falta de permissão, e
            dizê-lo aqui evita que se preencha o formulário todo para falhar no fim. */}
        {opcoes?.error && (
          <div className="rounded-xl border-l-[3px] border-l-danger bg-danger-light/30 px-4 py-3">
            <p className="text-sm font-medium text-text-primary flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-danger" /> A conta de anúncios não respondeu
            </p>
            <p className="text-xs text-text-secondary mt-1">{opcoes.error}</p>
          </div>
        )}
        {opcoes && !opcoes.configured && (
          <div className="rounded-xl border-l-[3px] border-l-warning bg-warning-light/30 px-4 py-3 text-sm text-text-secondary">
            Faltam <code>META_ACCESS_TOKEN</code> e <code>META_AD_ACCOUNT_ID</code> na Vercel.
          </div>
        )}

        {/* Passos */}
        <div className="flex items-center gap-2">
          {passos.map((p, i) => (
            <div key={p.n} className="flex items-center gap-2">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                passo === p.n ? "bg-piquet/15 text-piquet-700"
                  : passo > p.n ? "bg-success-light text-success" : "bg-surface-subtle text-text-muted")}>
                {passo > p.n ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{p.n}</span>}
                {p.label}
              </span>
              {i < passos.length - 1 && <span className="h-px w-4 bg-surface-border" />}
            </div>
          ))}
        </div>

        {loading && <p className="text-sm text-text-secondary">A ler a conta de anúncios…</p>}

        {/* ---------------------------- 1. CAMPANHA ---------------------------- */}
        {passo === 1 && (
          <div className="space-y-4 max-w-xl">
            <div className="flex gap-2">
              <button onClick={() => setNovaCampanha(true)}
                className={cn("text-xs px-3 py-1.5 rounded-full border", novaCampanha ? "border-piquet/30 bg-piquet/15 text-piquet-700" : "border-surface-border text-text-secondary")}>Nova campanha</button>
              <button onClick={() => setNovaCampanha(false)}
                className={cn("text-xs px-3 py-1.5 rounded-full border", !novaCampanha ? "border-piquet/30 bg-piquet/15 text-piquet-700" : "border-surface-border text-text-secondary")}>Usar existente</button>
            </div>
            {novaCampanha ? (
              <>
                <Field label="Nome da campanha">
                  <input value={campNome} onChange={(e) => setCampNome(e.target.value)} className="input-field" placeholder="Ex.: Leads Setembro — Canalização" />
                </Field>
                <Field label="Objetivo">
                  <select value={campObjetivo} onChange={(e) => setCampObjetivo(e.target.value)} className="input-field">
                    {(opcoes?.objectives ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Orçamento diário (€)" hint="Opcional — podes pô-lo no conjunto em vez de aqui">
                  <input type="number" min={1} value={campOrcamento} onChange={(e) => setCampOrcamento(e.target.value)} className="input-field" placeholder="10" />
                </Field>
              </>
            ) : (
              <Field label="Campanha">
                <select value={campanhaId} onChange={(e) => setCampanhaId(e.target.value)} className="input-field">
                  <option value="">Escolhe…</option>
                  {campanhas.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.status}</option>)}
                </select>
              </Field>
            )}
            <button onClick={gravarCampanha} disabled={aGravar || (novaCampanha ? !campNome.trim() : !campanhaId)}
              className="btn-primary text-sm disabled:opacity-40">{aGravar ? "A gravar…" : "Continuar"}</button>
          </div>
        )}

        {/* ---------------------------- 2. CONJUNTO ---------------------------- */}
        {passo === 2 && (
          <div className="space-y-4 max-w-xl">
            <div className="flex gap-2">
              <button onClick={() => setNovoConjunto(true)}
                className={cn("text-xs px-3 py-1.5 rounded-full border", novoConjunto ? "border-piquet/30 bg-piquet/15 text-piquet-700" : "border-surface-border text-text-secondary")}>Novo conjunto</button>
              <button onClick={() => setNovoConjunto(false)}
                className={cn("text-xs px-3 py-1.5 rounded-full border", !novoConjunto ? "border-piquet/30 bg-piquet/15 text-piquet-700" : "border-surface-border text-text-secondary")}>Usar existente</button>
            </div>
            {novoConjunto ? (
              <>
                <Field label="Nome do conjunto">
                  <input value={conjNome} onChange={(e) => setConjNome(e.target.value)} className="input-field" placeholder="Ex.: Portugal · 25-55" />
                </Field>
                <Field label="Orçamento diário (€)" hint="Deixa vazio se a campanha já tem orçamento">
                  <input type="number" min={1} value={conjOrcamento} onChange={(e) => setConjOrcamento(e.target.value)} className="input-field" placeholder="10" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Idade mínima">
                    <input type="number" min={13} max={65} value={idadeMin} onChange={(e) => setIdadeMin(e.target.value)} className="input-field" />
                  </Field>
                  <Field label="Idade máxima">
                    <input type="number" min={13} max={65} value={idadeMax} onChange={(e) => setIdadeMax(e.target.value)} className="input-field" />
                  </Field>
                </div>
                <p className="text-[11px] text-text-muted">
                  Segmentação geográfica: Portugal. Interesses e localizações finas continuam a fazer-se no Ads Manager —
                  replicá-las aqui seria reconstruir um seletor que a Meta atualiza todas as semanas.
                </p>
              </>
            ) : (
              <Field label="Conjunto">
                <select value={conjuntoId} onChange={(e) => setConjuntoId(e.target.value)} className="input-field">
                  <option value="">Escolhe…</option>
                  {conjuntos.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.status}</option>)}
                </select>
              </Field>
            )}
            <div className="flex gap-2">
              <button onClick={() => setPasso(1)} className="btn-secondary text-sm">Voltar</button>
              <button onClick={gravarConjunto} disabled={aGravar || (novoConjunto ? !conjNome.trim() : !conjuntoId)}
                className="btn-primary text-sm disabled:opacity-40">{aGravar ? "A gravar…" : "Continuar"}</button>
            </div>
          </div>
        )}

        {/* ---------------------------- 3. CRIATIVO ---------------------------- */}
        {passo === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-4">
              <Field label="Página que assina o anúncio">
                <select value={paginaId} onChange={(e) => setPaginaId(e.target.value)} className="input-field">
                  <option value="">Escolhe…</option>
                  {paginas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Imagem" hint="JPG ou PNG, até 8 MB">
                <label className="flex items-center gap-2 rounded-xl border border-dashed border-surface-border px-3 py-3 cursor-pointer hover:bg-surface-muted/50">
                  <Upload className="h-4 w-4 text-text-muted" />
                  <span className="text-sm text-text-secondary">{imagem ? "Trocar imagem" : "Escolher ficheiro"}</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarImagem(f); }} />
                </label>
              </Field>
              <Field label="Texto principal">
                <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} className="input-field"
                  placeholder="Precisa de um canalizador hoje? A Piquet encontra um técnico verificado perto de si." />
              </Field>
              <Field label="Título" hint="Opcional">
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input-field" placeholder="Técnicos verificados em 24h" />
              </Field>
              <Field label="Link de destino">
                <input value={link} onChange={(e) => setLink(e.target.value)} className="input-field" />
              </Field>
              <Field label="Botão">
                <select value={cta} onChange={(e) => setCta(e.target.value)} className="input-field">
                  {CTAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
            </div>

            {/* Pré-visualização — aproximada, não o render da Meta. */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Pré-visualização</p>
              <div className="card overflow-hidden max-w-sm">
                {imagem ? (
                  <Image src={imagem.url} alt="Criativo" width={400} height={300} unoptimized className="w-full object-cover" />
                ) : (
                  <div className="aspect-[4/3] bg-surface-subtle flex items-center justify-center text-xs text-text-muted">Sem imagem</div>
                )}
                <div className="p-3 space-y-1">
                  <p className="text-sm text-text-primary whitespace-pre-wrap">{texto || "Texto do anúncio…"}</p>
                  {titulo && <p className="text-sm font-semibold text-text-primary">{titulo}</p>}
                  <p className="text-[11px] text-text-muted">{link.replace(/^https?:\/\//, "")}</p>
                </div>
              </div>
              <p className="text-[11px] text-text-muted">
                Aproximada. O aspeto final varia com a colocação (feed, stories, reels) e só o Ads Manager o mostra ao certo.
              </p>
            </div>

            <div className="lg:col-span-2 flex gap-2">
              <button onClick={() => setPasso(2)} className="btn-secondary text-sm">Voltar</button>
              <button onClick={gravarCriativoEAnuncio}
                disabled={aGravar || !paginaId || !imagem || !texto.trim() || !link.trim()}
                className="btn-primary text-sm disabled:opacity-40">{aGravar ? "A criar…" : "Criar anúncio (em pausa)"}</button>
            </div>
          </div>
        )}

        {/* ------------------------------ 4. REVER ------------------------------ */}
        {passo === 4 && (
          <div className="space-y-4 max-w-xl">
            <div className="rounded-xl border-l-[3px] border-l-success bg-success-light/25 px-4 py-3">
              <p className="text-sm font-medium text-text-primary">Anúncio criado — e está em pausa.</p>
              <p className="text-xs text-text-secondary mt-1">
                Não gasta nada enquanto não for activado. Vê-o no Ads Manager antes de o pôr a correr.
              </p>
            </div>
            <div className="rounded-xl border border-surface-border divide-y divide-surface-border/60">
              {([["Campanha", campanhaId], ["Conjunto", conjuntoId], ["Criativo", criativoId], ["Anúncio", anuncioId]] as const)
                .filter(([, v]) => v)
                .map(([r, v]) => (
                  <div key={r} className="flex items-baseline justify-between gap-4 px-3 py-2">
                    <span className="text-xs text-text-muted">{r}</span>
                    <span className="text-xs font-mono text-text-primary">{v}</span>
                  </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`https://adsmanager.facebook.com/adsmanager/manage/ads?act=${(process.env.NEXT_PUBLIC_META_AD_ACCOUNT_ID ?? "").replace("act_", "")}`}
                target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">Abrir no Ads Manager</a>
              <button onClick={activar} disabled={aGravar} className="btn-primary text-sm disabled:opacity-40">
                {aGravar ? "A activar…" : "Activar agora"}
              </button>
            </div>
            <p className="text-[11px] text-text-muted">
              &ldquo;Activar agora&rdquo; põe campanha, conjunto e anúncio em ACTIVE — os três, porque um anúncio activo
              dentro de um conjunto em pausa não entrega nada. A partir daí gasta orçamento assim que a Meta aprovar.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
