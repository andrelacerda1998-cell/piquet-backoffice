# Anúncios reais (Meta Ads + Google Ads)

Pipeline já construída e em produção:

- **Tabela** `ad_metrics` na Supabase (desempenho diário por campanha)
- **Cron diário** na Vercel (06:20 UTC) → `/api/cron/ad-metrics` puxa das duas APIs,
  grava em `ad_metrics` e reagrega para a tabela `campaigns` que o Marketing já lê
- **Marketing** (campanhas, métricas, canais, criativos) passa a real assim que houver dados;
  enquanto as chaves faltarem, mantém os dados demo

Conversões/receita (CAC, ROAS) vêm **reportadas pelas plataformas** — exige o **Pixel do Meta**
e a **tag de conversão do Google** configurados nas apps/site. Sem isso, gasto/impressões/
cliques/CTR/CPC continuam reais, mas conversões vêm a zero.

---

## 1. Meta Ads (~1 dia)

1. **https://developers.facebook.com** → **My Apps → Create App** → tipo **Business** → dá um nome
2. No painel da app, adiciona o produto **Marketing API**
3. **Business Settings** (business.facebook.com/settings) → **Users → System Users** →
   **Add** → cria um system user (role *Admin*)
4. Nesse system user → **Generate New Token** → escolhe a tua app → permissões **`ads_read`**
   → **copia o token** (é o que não expira)
5. **Ad Account ID**: em Business Settings → **Accounts → Ad Accounts** → o ID no formato `act_...`
   (ou no Ads Manager, canto superior)

```bash
cd "~/Developer/Dashboard Piquet"
npx vercel env add META_ACCESS_TOKEN production     # o token do system user
npx vercel env add META_AD_ACCOUNT_ID production     # act_1234567890
```

## 2. Google Ads (a aprovação é lenta — começa já)

1. ⚠️ **Developer Token** — em **https://ads.google.com** com uma conta **Manager (MCC)** →
   **Tools → API Center** → pede o developer token. **Tem de ser aprovado pelo Google**
   (Basic Access; pode demorar dias a semanas). **Submete o pedido primeiro** — é o gargalo.
2. **OAuth2** — em https://console.cloud.google.com (mesmo projeto `piquet-app`):
   - **APIs & Services → Enable APIs** → ativa **Google Ads API**
   - **OAuth consent screen** → tipo Internal/External, adiciona o teu email como test user
   - **Credentials → Create Credentials → OAuth client ID → Desktop app** → guarda **client_id** e **client_secret**
   - Gera o **refresh token** com esse client (usa o [OAuth Playground](https://developers.google.com/oauthplayground):
     engrenagem → "Use your own OAuth credentials" → cola client id/secret → autoriza o scope
     `https://www.googleapis.com/auth/adwords` → "Exchange authorization code for tokens" → copia o **refresh_token**)
3. **Customer ID** — o número da conta de anúncios (Google Ads, canto superior, formato `123-456-7890` → usa só dígitos)

```bash
npx vercel env add GOOGLE_ADS_DEVELOPER_TOKEN production
npx vercel env add GOOGLE_ADS_CLIENT_ID production
npx vercel env add GOOGLE_ADS_CLIENT_SECRET production
npx vercel env add GOOGLE_ADS_REFRESH_TOKEN production
npx vercel env add GOOGLE_ADS_CUSTOMER_ID production        # só dígitos, sem hífens
# Se o acesso for através de uma conta Manager (MCC):
npx vercel env add GOOGLE_ADS_LOGIN_CUSTOMER_ID production  # ID da MCC, só dígitos
```

## 3. Ativar

```bash
npx vercel deploy --prod --yes   # ou um push (deploy automático)
```

O cron corre às 06:20 UTC. Cada plataforma é independente — configura só uma, ou ambas.
Diz ao Claude "já tenho as chaves do Meta/Google Ads" e ele testa, ingere e confirma nos gráficos.

## Notas

- **Reprocessa 7 dias** a cada corrida — as conversões das plataformas ajustam-se retroativamente.
- Quando entrarem campanhas reais, o mock desaparece automaticamente do Marketing.
- O `CRON_SECRET` já protege o endpoint.
