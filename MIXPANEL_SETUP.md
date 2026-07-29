# Ligar o funil da app (Mixpanel) ao backoffice

O backoffice mostra o **funil da jornada na app** em **Produto → Funil (app)**:
onde os utilizadores param (ex.: abrir app → ver serviço → iniciar reserva → pagar).
Os dados vêm do **Mixpanel** via Query API, com um **Service Account**.

Pré-requisito 1: o projeto Mixpanel já tem de estar a **receber eventos** da app
(o Mixpanel está instrumentado na app). Se ainda não recebe, o funil aparece vazio.

Pré-requisito 2 (**importante**): a **Query API do Mixpanel exige um plano pago**.
No plano gratuito a API devolve `402 — "Your plan does not allow API calls"`, mesmo
com as credenciais certas. Sem plano pago, vês os funis na **app do Mixpanel** (grátis),
mas não dá para os trazer para o backoffice.

## 1. Criar um Service Account (só de leitura chega)

Mixpanel → **Organization Settings → Service Accounts → Add Service Account**
- Role: **Analyst** (leitura) ou superior.
- Guarda o **Username** e o **Secret** (o secret só aparece uma vez).

## 2. Obter o Project ID

Mixpanel → **Project Settings** → copia o **Project ID** (um número).

## 3. Definir o funil no Mixpanel

Mixpanel → **Funnels/Reports** → cria um funil com os passos da jornada
(ex.: `App Open` → `View Service` → `Start Booking` → `Purchase`) e **guarda-o**.
Abre o funil guardado e copia o **funnel_id** do URL. (Se não definires um id, o
backoffice usa automaticamente o primeiro funil guardado do projeto.)

## 4. Adicionar as variáveis na Vercel

Projeto **piquet-dashboard** → Settings → Environment Variables (Production):

| Variável | Valor | Obrigatória |
|---|---|---|
| `MIXPANEL_SA_USERNAME` | username do Service Account | sim |
| `MIXPANEL_SA_SECRET` | secret do Service Account | sim |
| `MIXPANEL_PROJECT_ID` | id do projeto | sim |
| `MIXPANEL_FUNNEL_ID` | id do funil guardado | não (senão usa o 1.º) |
| `MIXPANEL_API_HOST` | `https://eu.mixpanel.com` se o projeto for na **UE** | não (default US) |

> **Residência de dados:** se criaste o projeto na região da UE, a API só responde
> em `https://eu.mixpanel.com` — nesse caso define `MIXPANEL_API_HOST`. Projetos
> nos EUA usam o default `https://mixpanel.com`.

Depois de adicionar, faz **Redeploy** (ou avisa que eu faço). A aba **Funil (app)**
passa a mostrar o funil e o drop-off de cada passo.

## Como funciona (backoffice)

- `GET /api/product/funnel?from=YYYY-MM-DD&to=YYYY-MM-DD` (staff) → chama a Query
  API do Mixpanel (`/api/query/funnels`), soma os passos ao longo do período e
  devolve, por passo: nº de utilizadores, conversão vs. topo, e **% de drop-off**.
- Sem as variáveis, devolve `configured:false` e a aba mostra este guia — nunca um
  funil inventado.
