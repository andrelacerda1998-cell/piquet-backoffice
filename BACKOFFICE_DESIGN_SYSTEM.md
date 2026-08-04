# Design System — Backoffice Piquet

Formaliza o que já existe (é bom) e fecha as lacunas. O objetivo é **consistência
+ tokens reutilizáveis**, eliminando valores hardcoded.

---

## 1. Fundações (já existentes — manter)

**Cor (tokens em CSS vars, `globals.css`, claro + escuro):**
- Superfícies: `--surface`, `--surface-muted`, `--surface-subtle`, `--surface-border`, `--surface-strong`.
- Texto: `--text-primary`, `--text-secondary`, `--text-muted`.
- Marca: **Piquet** dourado `#FAB347` (escala 50–900 no `tailwind.config`).
- Semânticos: `success #1F9D6B`, `warning #E39A1C`, `danger #D6503B`, `info #3E7C8C` (+ `-light` por var, que troca no dark).

**Regra:** usar sempre os tokens (`text-text-secondary`, `bg-surface-subtle`,
`bg-piquet/15`, `text-success`…). **Não** hardcodar hex nas páginas.

---

## 2. Lacunas a fechar (🟠)

- **Espaçamento / grid / raios / sombras:** normalizar numa escala (ex.: espaço
  `1/2/3/4/6/8`, raio `md/lg/xl`, sombra `card/elevated`). Hoje há valores
  soltos (`rounded-lg`, `rounded-xl`, `shadow-elevated`) sem catálogo.
- **Densidade:** definir "confortável" (default) e "compacto" (tabelas densas).
- **Deltas de métrica:** um único componente que só mostra variação **quando há
  histórico real** (mata o P04).
- **Estados vazios:** há `States`; falta um padrão visual único (ícone + título +
  ação sugerida) reutilizado em todas as listas.

---

## 3. Catálogo de componentes

| Componente | Estado | Ação recomendada |
|---|---|---|
| `DataTable` | Existe (sort, paginação, rowClick) | ➕ colunas configuráveis, vistas, seleção, ações em massa, menu "⋯", densidade |
| `Modal` + `Field` | Bom | ✅ manter; usar para **todas** as confirmações (tirar `window.prompt/confirm`) |
| `Tabs` / `SubTabs` | Bom | ✅ reutilizar na nova IA |
| `MetricCard` | Bom | Ajustar aos deltas reais; variante "com drill-down" |
| `StatusBadge` | Bom (central) | Passar a única fonte de estados (§5); nunca cor local |
| `DemoBadge` | Bom | Manter enquanto houver demo; remover à medida que liga |
| `States` (loading/error/vazio) | Existe | Padrão único de estado vazio |
| `Toaster` / `toast` | Bom | ✅ feedback consistente |
| Drawers (Service/Customer/Technician/TechApproval/SupportTicket) | Existem, inconsistentes | Unificar estrutura (topo + tabs + timeline) |
| `Charts` | Bom | Regras do §UX (uma pergunta por gráfico) |
| **`Timeline`** | ➕ Não existe | Criar (eventos por entidade) |
| **`FilterBar`** | ➕ Não existe (lógica dispersa) | Criar (rápidos + avançados + vistas + chips) |
| **`EntitySearch` (⌘K entidades)** | ➕ Não existe | Criar |
| **`ConfirmDialog`** | ➕ (hoje `window.confirm`) | Criar (consequências + motivo + loading) |

---

## 4. Estados de componente (obrigatórios)

Todos os interativos devem ter: **Normal · Hover · Focus (visível) · Active ·
Disabled · Loading · Error · Success.** O foco visível é crítico para uso por
teclado (backoffice = muito teclado).

---

## 5. Sistema de estados (negócio)

Fonte única (`StatusBadge` + um mapa central). Cada estado = **cor + texto +
ícone + tooltip**, nunca só cor:

| Estado | Tom | Uso |
|---|---|---|
| Novo / Pedido recebido | info | serviços, leads |
| Pendente / A aguardar | warning | pagamentos, orçamentos |
| Agendado | info | serviços |
| Aceite / Aprovado | success | técnicos, orçamentos |
| Em curso / Em execução | piquet | serviços |
| Concluído / Executado | success | serviços, leads |
| Cancelado | surface-muted | serviços, leads |
| Falhou | danger | pagamentos |
| Reembolsado | warning | pagamentos |
| Em análise | info | KYC, recrutamento |
| Bloqueado / Suspenso | danger | clientes, técnicos |

**Regra:** o mesmo estado tem **a mesma cor em todas as páginas** (hoje há
divergências locais — corrigir).

---

## 6. Ícones

`lucide-react` já é o standard. Regra: **um ícone por conceito** (ex.: sempre o
mesmo para "técnico", "pagamento", "serviço") — catalogar num mapa
`icons.ts` para evitar divergências.

---

## 7. Como aplicar

1. Extrair tokens em falta (espaço/raio/sombra/densidade) para `tailwind.config`
   + `globals.css`.
2. Criar os componentes novos (`Timeline`, `FilterBar`, `EntitySearch`,
   `ConfirmDialog`) e a evolução do `DataTable`.
3. Substituir usos locais (cores de estado, `window.confirm`, deltas fabricados)
   pelos componentes/tokens centrais — página a página, sem regressões.
