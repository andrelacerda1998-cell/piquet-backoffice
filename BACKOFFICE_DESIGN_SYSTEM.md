# Design System — Backoffice Piquet

A gramática visual do backoffice depois do redesenho de outubro de 2026. Serve
para que um ecrã novo se pareça com os outros sem ninguém ter de adivinhar:
que componente usar, que cor, que peso de letra.

Princípio: **calmo por omissão, cor só onde muda o que se faz.** O dourado é
para a ação principal; o vermelho e o âmbar são para o que pede atenção; o
resto é papel, grafite e cinzentos quentes.

---

## 1. Fundações

**Tipo de letra:** Geist (texto) e Geist Mono (códigos, IBAN, ids), via
`next/font` em `src/app/layout.tsx`. Números sempre com algarismos de largura fixa (`tabular-nums`,
ligado por omissão no `html`), para as colunas de valores alinharem.

**Cor:** tokens em CSS vars (`src/app/globals.css`), claro e escuro. Nunca hex
numa página — só nos gráficos, onde o Recharts precisa de cor concreta.

| Token | Uso |
|---|---|
| `surface` | cartões, tabelas, janelas |
| `surface-muted` | fundo da página |
| `surface-subtle` | cabeçalhos de tabela, hover, segmentados |
| `surface-border` / `surface-strong` | riscas / riscas com mais peso |
| `surface-sidebar` | barra lateral (segue o tema) |
| `text-primary` / `text-secondary` / `text-muted` | texto, por importância |
| `piquet` (escala 50–900) | marca: botão principal, item ativo, foco |
| `success` / `warning` / `danger` / `info` (+ `-light`) | estados e avisos |

Todos os pares texto/fundo passam AA (4,5:1) nos dois temas —
`src/lib/contraste.test.ts` verifica-o.

**Forma:** cartões `rounded-card` (12 px) com `shadow-card` (transparente no
escuro); janelas `rounded-2xl` com `shadow-elevated`; botões e campos
`rounded-lg`.

---

## 2. Estrutura de página

- **Barra lateral** (`Sidebar`): segue o tema, item ativo com fundo
  `surface-subtle` e traço dourado à esquerda.
- **Barra de topo** (`Topbar`): pesquisa (⌘K), "+ Novo", notificações, conta.
- **`PageHeader`**: título da página (h1) + subtítulo + ações à direita. Um
  por página — um ecrã embutido noutro (Produto em Crescimento, Impostos e RH
  no Financeiro) **não** traz o seu.
- **`Tabs`**: separadores da página, sublinhados. Dentro de um separador, os
  sub-separadores usam `variant="pill"` (segmentado), nunca outro sublinhado.
- **`SectionHeader`**: título de secção (h2) em frase normal, com descrição
  por baixo e ação à direita (`aside`).

## 3. Componentes

| Componente | Para quê |
|---|---|
| `StatGroup` + `Stat` (`ui/Stats`) | Números lado a lado num só cartão. `tone` pinta o valor (`mau` vermelho, `atencao` âmbar, `bom` verde); `info` põe um ⓘ com a definição; `note` diz de onde sai o número. |
| `Painel` | Cartão com cabeçalho (título, descrição, ação). Os gráficos (`ChartCard`) usam-no. |
| `Barra` | Ranking curto (funil, cidades, motivos) — em vez de um gráfico. |
| `Segmentado` | Filtro de estado com contagens; `tom: "alerta"` pinta a contagem a vermelho. |
| `DataTable` | Listas. Filtros na `toolbar`, exportar em `actions`. No telemóvel cada linha vira um cartão. |
| `FichaSeccao`, `Etiqueta`, `ListaDeDados`, `FichaVazia` (`ui/Ficha`) | As fichas (cliente, técnico) e os painéis laterais. |
| `InfoTip` | A definição de um número; abre por cima de tudo, nunca fica cortada. |
| `Modal` / `ConfirmDialog` | Janelas; o que não tem volta pede confirmação (e motivo, quando fica registado). |
| `.aviso` + `.aviso-atencao` / `-perigo` / `-sucesso` / `-info` | Avisos dentro da página. Nada de barras coloridas à esquerda. |
| `.btn-primary` / `.btn-secondary` / `.btn-ghost` | Uma ação principal por zona; ações de linha em `btn-ghost`. |
| `.link` | Link no meio de texto: cor do texto e sublinhado discreto. |

## 4. Regras

- **Frase normal, nunca maiúsculas espaçadas** em títulos e rótulos.
- **Pesos:** `font-semibold` para títulos e valores, `font-medium` para nomes;
  sem `font-bold`.
- **Números à direita** nas tabelas, sempre `tabular-nums`; dinheiro com
  `formatCurrency`, avaliações com `formatRating` ("4,8").
- **Ações de linha aparecem ao passar o rato** (`md:opacity-0
  md:group-hover:opacity-100`) — no telemóvel estão sempre à vista. A ação do
  dia (ex.: "Marcar paga") pode ficar sempre visível.
- **O que não tem volta fica ao fundo**, separado (ex.: "Apagar este técnico").
- **Vazio é uma frase**, num cartão calmo — e o ecrã nunca se dá por verificado
  vazio: confirma-se com dados.
- **Sem controlos que não fazem nada**: um botão sem efeito sai.

## 5. Estados (negócio)

Duas formas, para não se confundirem:

- **Estado** (do pedido, do ticket, do pagamento): `StatusBadge` — pílula
  redonda com ponto e texto (só a primeira letra maiúscula). A cor vem de
  `getStatusColor`, um mapa central: o mesmo estado tem a mesma cor em todo o
  lado.
- **Etiqueta** (características: "Cliente", "Outlook", "Sem NIF", "AT
  validada"): `Etiqueta` ou `rounded-md` — retângulo, nunca pílula.

| Tom | Quando |
|---|---|
| `danger` | falhou, bloqueado, à espera da Piquet, atrasado |
| `warning` | pede atenção mas não é falha (por validar, à espera do cliente) |
| `success` | feito, pago, aprovado |
| `info` | em curso, à procura de técnico |
| `surface-subtle` | fechado, cancelado, sem serviço |

## 6. Ícones

`lucide-react`. Ícones só onde ajudam a reconhecer (navegação, ações, canais);
títulos de secção não levam ícone.
