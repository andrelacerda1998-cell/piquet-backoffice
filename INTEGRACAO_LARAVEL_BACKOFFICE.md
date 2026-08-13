# Ligar o backoffice (Next.js) aos dados reais do Laravel

Lista dos endpoints que faltam expor na **API de admin do Laravel** (`v1/admin/*`)
para o backoffice deixar de usar dados manuais/seed e passar a ler a operação
real (reservas, clientes, técnicos, pagamentos).

Segue o mesmo padrão que já usaste para **Taxas, Lucro do sistema, Vouchers e
KYC** (`src/lib/laravelAdmin.ts`): servidor-a-servidor, `Bearer` do
`AdminApiToken`, envelope `{ data: ... }`. Do lado do Next, cada endpoint é
ligado um de cada vez (o `api.ts` já está preparado) — tu expões, eu mapeio.

---

## Convenções (para todos os endpoints)

- **Base / auth:** `GET {LARAVEL_ADMIN_API_URL}/v1/admin/...` com `Authorization: Bearer <AdminApiToken>` (já feito).
- **Envelope:** `{ "data": ... }` (como no `system-profit`).
- **Paginação:** quando a lista é grande, `data = { "items": [...], "meta": { "current_page", "last_page", "per_page", "total" } }`.
- **Datas:** ISO 8601 em UTC (ex.: `2026-07-29T10:00:00Z`).
- **Dinheiro:** euros em decimal (ex.: `104.55`). Se guardas em cêntimos, diz-me e converto eu.
- **Nomes dos campos:** à tua escolha (snake_case está ótimo). O mapeamento para o que o frontend usa é feito no Route Handler do Next — não te preocupes com isso.

---

## Prioridade 1 — Serviços / Reservas  ⭐ (o desbloqueio principal)

Alimenta a aba **Operações** e, por derivação, **Clientes, Técnicos, GMV e Financeiro**.

### `GET /v1/admin/services`
Lista paginada. **Query:** `page`, `per_page`, `status`, `from`, `to`, `search`, `city`, `technician_id`, `customer_id`.

Cada item (`data.items[]`):

| Campo | Notas |
|---|---|
| `id` | |
| `customer_id`, `customer_name` | |
| `technician_id`, `technician_name` | nulos se ainda sem técnico |
| `category_id`, `category_name` | |
| `service_name` | |
| `location`, `city` | |
| `source` | app / web / etc. |
| `status` | ver **Mapa de estados** abaixo |
| `requested_at`, `scheduled_at`, `started_at`, `completed_at` | ISO; nulos conforme a fase |
| `total_customer_value` | € cobrado ao cliente |
| `technician_value` | € do técnico |
| `piquet_revenue` | comissão Piquet (ou calculo eu = total − técnico) |
| `vat_value` | IVA, se tiverem |
| `payment_status` | pendente / pago / parcial / reembolsado / falhado |
| `invoice_status` | se existir (senão ignoro) |
| `rating` | 1–5 ou nulo |
| `has_complaint` | booleano |
| `cancellation_reason` | quando cancelado |
| `response_time_minutes`, `technician_assignment_time_min` | se existirem (métricas de qualidade) |

### `GET /v1/admin/services/{id}`
Detalhe — os mesmos campos + `internal_notes[]` e histórico de estados, se houver.

---

## Prioridade 2 — Clientes

Alimenta a aba **Clientes** (lista, segmentos, métricas).

### `GET /v1/admin/customers`
Paginada. **Query:** `page`, `per_page`, `search`, `city`, `from`, `to`.

Campos: `id`, `name`, `email`, `phone`, `registered_at`, `location`, `city`, `source`, `last_service_at`.

Métricas por cliente (`service_count`, `total_spent`, `piquet_revenue`, `complaint_count`, `average_rating`): **inclui-as se for barato no Laravel**; senão, o dashboard calcula-as a partir dos serviços — sem problema.

### `GET /v1/admin/customers/{id}`
Detalhe + serviços do cliente.

---

## Prioridade 3 — Técnicos / Vendors

Já tens o **KYC** (`vendor-documents`). Falta a **lista e o perfil** dos técnicos.

### `GET /v1/admin/vendors`
Paginada. **Query:** `page`, `per_page`, `search`, `city`, `status`, `category`.

Campos: `id`, `name`, `email`, `phone`, `categories[]`, `specializations[]`, `location`, `city`, `status`, `documentation_complete`, `registered_at`, `approved_at`, `last_activity_at`.

Métricas (`services_completed`, `acceptance_rate`, `cancellation_rate`, `average_rating`, `piquet_revenue`, `amount_received`): daqui ou derivadas pelo dashboard.

### `GET /v1/admin/vendors/{id}`
Detalhe do técnico.

---

## Prioridade 4 — Pagamentos

Complementa/valida o que já vem do Payshop (aba **Pagamentos da app**).

### `GET /v1/admin/payments`
Paginada. Campos: `id`, `service_id`, `customer_name`, `amount`, `method`, `status`, `created_at`, `captured_at`, `refunded_at`.

---

## Agregados (opcional)

O dashboard **já sabe derivar** GMV, receita por técnico/categoria, resumo
financeiro, etc., a partir dos serviços. Só vale a pena exporem endpoints
prontos (`/v1/admin/finance/summary`, ...) se já os têm calculados e mais
fiáveis do lado do Laravel. Caso contrário, expõe só as entidades cruas acima
e eu monto os agregados no dashboard.

---

## Mapa de estados (importante)

A aba Operações usa estes 15 estados. Preciso que me digas **como os estados do
Laravel correspondem a estes** — ou então expõe o estado "cru" e eu faço o mapa:

`pedido_recebido, a_procurar_tecnico, tecnico_encontrado, a_aguardar_orcamento,
orcamento_enviado, a_aguardar_pagamento, pago, agendado, em_execucao,
concluido, cancelado_cliente, cancelado_tecnico, sem_tecnico_disponivel,
reembolsado, em_reclamacao`

---

## O que **fica no dashboard** (Supabase — NÃO precisa do Laravel)

Para não haver dúvidas sobre a fronteira, isto é gestão interna e continua no Supabase:

- **Planeamento financeiro** (orçamento mensal) e **faturas de custos** (fornecedores: renda, software…).
- **Colaboradores internos** (Impostos e RH) — a equipa Piquet, não os técnicos.
- **Tarefas pessoais** (Kanban), **objetivos do ano**.
- **Leads da landing** (piquetapp.com → CRM).
- **Integrações** já reais: downloads das lojas, Meta Ads, Mixpanel, Payshop.

---

## Como ligamos (do meu lado)

Para cada endpoint que expuseres, eu:
1. Crio o Route Handler no Next que chama `laravelAdminRequest("/v1/admin/...")`.
2. Mapeio os campos para o que o ecrã usa.
3. Passo o endpoint de demo → real no `api.ts` (`LIVE_EXACT` + `REAL_DATA`), sem partir os outros.

Sugestão de ordem: **Serviços → Clientes → Técnicos → Pagamentos**. Assim que
os Serviços estiverem ligados, Clientes/Técnicos/GMV ganham logo dados reais por
derivação.

---

## Estado: Serviços (Prioridade 1) — casca já pronta ✅

Do lado do Next já está feito o adaptador, **dormente** até dizeres que o
endpoint existe. Ficheiro: `src/app/api/_lib/laravelServices.ts`; ligado em
`src/app/api/services/route.ts` atrás de um interruptor.

**Para ligar, faltam 3 passos (rápidos):**

1. **Expor** `GET /v1/admin/services` (formato acima).
2. **Confirmar** duas coisas no ficheiro `laravelServices.ts`:
   - os **nomes exatos dos campos** que devolves (ajusto `LaravelServiceRow` se forem diferentes);
   - os **valores de `status`** do teu lado → preencho `LARAVEL_STATUS_MAP` (ex.: `finished → concluido`). Se já usares as mesmas chaves pt-PT, passam diretas.
3. **Ligar o interruptor**: env var `LARAVEL_SERVICES_ENABLED=true` na Vercel.

Enquanto o passo 3 não é dado, o `/api/services` continua a ler o Supabase
(serviços manuais) — zero risco. Assim que ligares, verifico contra os dados
reais e depois é só replicar o mesmo padrão para Clientes, Técnicos e Pagamentos.

---

## Subutilizador AT (Portal das Finanças) — falta no backend ⚠️

O backoffice precisa de **validar o subutilizador AT** de cada técnico (o acesso
que ele dá à Piquet para emitir faturas em nome dele). O ecrã já está feito
(perfil do técnico → "Subutilizador AT"), mas hoje só consegue mostrar
`at_valid` (sim/não): **o `VendorController` não envia o identificador**, e não
há rota para gravar a validação. Sem o número, quem valida está a carregar num
botão às cegas.

### 0. O `at_valid` não é fiável — medido em produção (12/08/2026)

Numa amostra de **100 técnicos** da API real:

| | técnicos |
|---|---|
| `at_valid = true` **com** `at_validated_at` | **11** |
| `at_valid = true` **sem** `at_validated_at` | **37** ← problema |
| `at_valid = false` | 52 |

Dos 37 com a flag ligada e sem data, **nenhum** podia aceitar serviço e só 7
tinham NIF preenchido. Conclusão: **a flag vem ligada de origem no registo**, não
por alguém ter conferido o subutilizador. O backoffice mostrava ✓ a 48 técnicos
quando só 11 estavam mesmo validados.

Enquanto não for corrigido no backend, o backoffice passou a tratar como
validado **apenas quem tem `at_validated_at`**; a flag ligada sem data aparece
como "Por confirmar" (?), nunca como ✓.

**Pedido:** que o `at_valid` deixe de vir `true` por omissão — deve ser `false`
até haver validação efetiva, e passar a `true` só quando se grava a data.

### 1. Acrescentar campos ao `GET /v1/admin/vendors`

```jsonc
{
  "id": 12,
  "at_valid": true,
  "at_validated_at": "2026-07-20",
  "at_username": "212345678/1",   // ← identificador do subutilizador
  "at_validated_by": "André Lacerda" // ← opcional: quem validou
}
```

O backoffice já aceita `at_username`, `at_user` ou `at_subuser` — usa o nome que
tiveres na base de dados, não é preciso renomear nada.

> **A senha do subutilizador não deve ser enviada.** O backoffice não a mostra
> nem a guarda; para conferir o acesso basta o identificador.

### 2. Criar `PUT /v1/admin/vendors/{id}/at-validation`

```jsonc
// body
{ "valid": true }   // ou false, para retirar a validação

// resposta
{ "data": { "id": 12, "at_valid": true, "at_validated_at": "2026-08-11" } }
```

Deve gravar também **quem** validou (o staff autenticado), para haver rasto.

Enquanto a rota não existir, o botão "Validar" devolve uma mensagem explícita
("O backend ainda não tem a rota de validação AT…") em vez de fingir que gravou.
Assim que existir, funciona sem mais alterações do lado do Next.

---

## Cobertura por zona — falta a morada do técnico ⚠️

Medido na API real (13/08/2026): **a `oferta` vem a zero em todas as cidades**,
enquanto a procura é real e substancial:

| Cidade | Pedidos | Oferta reportada |
|---|---|---|
| Costa de Caparica | 106 | 0 |
| Almada | 77 | 0 |
| Torres Vedras | 25 | 0 |
| Lisboa | 16 | 0 |

A causa: a `oferta` é calculada a partir das **zonas que os técnicos declaram na
app** (`AllowedZone` / survey vote) — e **ninguém declarou** (as 14 zonas abertas
têm 0 técnicos, as 12 candidatas têm 0 interessados). Com 443 técnicos
registados e serviços a acontecer nessas cidades, o número não descreve a
realidade: não é "não há técnicos", é "não está medido".

O backoffice deixou de afirmar "nenhum técnico cobre esta zona" — passa a dizer
que a cobertura está por medir. Mas a estatística útil continua por fazer.

### O que falta expor

**1. Morada / cidade do técnico** no `GET /v1/admin/vendors`:

```jsonc
{
  "id": 443,
  "name": "Liber Bravo",
  "city": "Almada",           // ← o que permite contar técnicos por zona
  "district": "Setúbal",      // opcional
  "postal_code": "2800-000"   // opcional
}
```

Com isto, o backoffice calcula sozinho quantos técnicos há por cidade e cruza
com a procura — sem depender de os técnicos declararem nada na app.

**2. Em alternativa (melhor ainda):** que a `oferta` no
`GET /v1/admin/vendors/coverage` passe a contar os técnicos que **já executaram
serviços** naquela cidade. É evidência de facto, não uma declaração — e responde
diretamente a "quem consigo mandar a Almada amanhã?".

As duas podem coexistir: morada = onde vive; serviços executados = onde trabalha
mesmo.

---

## BUG: `GET /v1/admin/vendor-documents` rebenta em certas páginas 🐛

Sintoma no backoffice: **técnicos validados há mais tempo apareciam sem
documentos**. Duas causas — uma minha (já corrigida), outra do backend.

### Medição (13/08/2026, API de produção)

```
status=approved  → total = 449 documentos
per_page=20  → OK          per_page=25  → "Server Error"
per_page=50  → "Server Error"   per_page=100 → "Server Error"
```

Com `per_page=20`, algumas páginas falham e outras não:

```
página 1 → OK      página 2 → Server Error     página 3,4,5 → OK
página 6 → Server Error
```

Reduzindo a granularidade, o erro isola-se em documentos concretos: as posições
21 e 22 respondem (ids 484 e 486, "Wilgner macedo"), e as **23, 24 e 25 dão
erro** — os ids em falta nessa janela são os **481, 482 e 483**.

Falha em ~0,4 s, portanto **não é timeout**: são registos que o serializador não
consegue processar (ficheiro em falta no disco? `document_type` nulo? URL
assinado a rebentar?). O mesmo acontece com `status=declined`.

### Impacto real medido

Com páginas de 20 e recuperação em pedaços de 5, o backoffice consegue ler
**399 dos 449** documentos aprovados — **50 continuam inacessíveis** porque o
backend rebenta neles. Exemplo concreto: o técnico **Nuno Santos (id 9)** tem os
três documentos obrigatórios aprovados (ids 35, 41 e 192) mas aparecia sem
nenhum, porque a página onde vivem falhava.

Nota: vários documentos vêm com `document_type: null` (ex.: ids 36, 37, 38) — o
backoffice não os consegue classificar e mostra-os como "outros documentos".
Valeria a pena perceber se é um campo por preencher ou dados corrompidos.

### O que já foi feito do lado do backoffice

- Passou a percorrer **todas** as páginas (antes lia só as primeiras 100 de 449 —
  daí faltarem os mais antigos);
- Quando uma página rebenta, tenta em pedaços de 10 para salvar o que der;
- O que não vier é contado e o ecrã avisa que a lista está incompleta, em vez de
  mostrar "sem documentos" (que seria falso).

### O que falta do lado do Laravel

1. Descobrir porque é que os documentos **481, 482, 483** (e outros) rebentam —
   um `try/catch` por registo no controller já evitaria deitar a página inteira
   abaixo.
2. Confirmar o limite real de `per_page` (aceita 100 em `pending`, mas rebenta
   em `approved`) — se o limite for menor, devolver erro claro em vez de 500.
