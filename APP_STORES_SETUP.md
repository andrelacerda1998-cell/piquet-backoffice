# Downloads reais das lojas (App Store + Google Play)

A pipeline já está construída e em produção:

- **Tabela** `app_metrics` na Supabase (downloads diários por app/plataforma)
- **Cron diário** na Vercel (06:10 UTC) → `/api/cron/app-metrics` vai às duas lojas e grava
- **Gráficos** em Produto → Apps lêem de `/api/product/growth` (os **registos** já são reais;
  os **downloads** usam a série demo até as chaves abaixo existirem)

Falta apenas criares as credenciais — exigem o teu login de developer — e colá-las na Vercel.

---

## 1. Apple — App Store Connect (≈5 min)

1. https://appstoreconnect.apple.com → **Users and Access → Integrations → App Store Connect API**
2. **Generate API Key** — nome `piquet-dashboard`, perfil **Sales and Finance**
3. Descarrega o ficheiro **`.p8`** (⚠️ só dá para descarregar UMA vez) e anota:
   - **Issuer ID** (topo da página)
   - **Key ID** da chave criada
4. **Vendor Number**: App Store Connect → Payments and Financial Reports → canto superior esquerdo (nº tipo `85012345`)
5. O **SKU** de cada app: App Store Connect → a app → App Information → SKU

```bash
cd "~/Developer/Dashboard Piquet"
npx vercel env add APPLE_ISSUER_ID production      # cola o Issuer ID
npx vercel env add APPLE_KEY_ID production         # cola o Key ID
npx vercel env add APPLE_VENDOR_NUMBER production  # cola o vendor number
npx vercel env add APPLE_SKU_CLIENTE production    # SKU da app Cliente
npx vercel env add APPLE_SKU_PRO production        # SKU da app Profissional
# A chave privada (conteúdo do .p8 inteiro, incluindo BEGIN/END):
cat ~/Downloads/AuthKey_XXXXXX.p8 | npx vercel env add APPLE_PRIVATE_KEY production
```

## 2. Google — Play Console (≈10 min)

1. https://console.cloud.google.com → cria (ou usa) um projeto → **IAM e administração → Contas de serviço → Criar**
   — nome `piquet-dashboard-stats`; sem papéis no projeto (não precisa)
2. Na conta de serviço → **Chaves → Adicionar chave → JSON** — descarrega o ficheiro
3. https://play.google.com/console → **Utilizadores e permissões → Convidar novo utilizador**
   → email da conta de serviço (`...@....iam.gserviceaccount.com`) → permissão **"Ver informações da app e transferir relatórios em massa"**
4. O **bucket** dos relatórios: Play Console → **Transferir relatórios → Estatísticas** → "Copiar URI do Cloud Storage"
   (formato `gs://pubsite_prod_rev_.../stats/installs/` — o bucket é a parte `pubsite_prod_rev_...`)

```bash
# Do JSON descarregado: client_email e private_key
npx vercel env add GOOGLE_SA_EMAIL production        # client_email do JSON
npx vercel env add GOOGLE_SA_PRIVATE_KEY production  # private_key do JSON (com \n)
npx vercel env add GOOGLE_PLAY_BUCKET production     # pubsite_prod_rev_...
npx vercel env add GOOGLE_PACKAGE_CLIENTE production # applicationId da app Cliente
npx vercel env add GOOGLE_PACKAGE_PRO production     # applicationId da app Profissional
```

## 3. Ativar

Depois de adicionar as variáveis, um re-deploy aplica-as:

```bash
npx vercel deploy --prod --yes
```

O cron corre todos os dias às 06:10 UTC. Para testar imediatamente sem esperar:
Vercel → piquet-dashboard → **Settings → Cron Jobs → Run** (ou pede ao Claude para invocar).

## Notas

- **Ambas as lojas são opcionais e independentes** — podes configurar só uma; a outra fica
  reportada como "skipped" no resultado do cron, sem erro.
- A Apple publica os relatórios com ~1 dia de atraso; a Google atualiza o CSV mensal ao longo
  do mês. O cron reconsulta os dias recentes, e o upsert é idempotente (sem duplicados).
- As apps têm de estar **publicadas** nas lojas para haver relatórios.
- O `CRON_SECRET` já está configurado na Vercel — protege o endpoint de invocações externas.
