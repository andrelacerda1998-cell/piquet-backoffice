# Faturas automáticas do Outlook → Financeiro

Sempre que chega uma fatura por email, ela aparece automaticamente em
**Financeiro → Custos e faturas → Faturas a pagar**, em estado **Pendente**,
para confirmares o valor num clique.

Não precisas de registar nenhuma app no Azure nem de programar. Usa-se o
**Power Automate** (já incluído no Office 365), que envia os dados do email
para um endpoint do dashboard.

## Endpoint

```
POST https://piquet-dashboard.vercel.app/api/webhooks/outlook-invoice?key=617a512aadd4dd558d58d9b1e2f0ca66ee1e6494ae37fb67
```

(a `key` autentica o pedido — mantém-na privada)

## Criar o fluxo no Power Automate (~5 min)

1. Vai a [make.powerautomate.com](https://make.powerautomate.com) e inicia sessão
   com a conta Microsoft 365 da Piquet.
2. **Criar → Fluxo de nuvem automatizado**.
3. Acionador: **"Quando chega uma nova mensagem de correio (V3)"** (Outlook 365).
   - Pasta: **Caixa de Entrada**
   - Em opções avançadas, podes filtrar: **Tem anexos = Sim**, e/ou
     **Assunto contém = fatura** (para só disparar em faturas).
4. **+ Novo passo → HTTP**:
   - **Método:** `POST`
   - **URI:** o endpoint acima (com a `key`)
   - **Cabeçalhos:** `Content-Type` → `application/json`
   - **Corpo:**
     ```json
     {
       "subject": "@{triggerOutputs()?['body/subject']}",
       "from": "@{triggerOutputs()?['body/from']}",
       "receivedAt": "@{triggerOutputs()?['body/receivedDateTime']}",
       "attachmentName": "@{triggerOutputs()?['body/attachments'][0]?['name']}",
       "webLink": "@{triggerOutputs()?['body/webLink']}"
     }
     ```
     (usa os campos dinâmicos que o Power Automate sugere; os nomes acima são os
     típicos do conector Outlook 365)
5. **Guardar**. Envia-te uma fatura de teste a ti próprio e confirma que
   aparece no dashboard.

## O que acontece a cada fatura

- Entra como **Pendente**, com o **fornecedor** (remetente), **assunto** e um
  **link para o email/anexo**.
- O **valor fica a 0** — na Fase 1 confirma-lo à mão ao rever (o campo `amount`
  no corpo é opcional; se o teu fluxo já o extrair, envia-o e entra preenchido).
- No dashboard: **Marcar paga**, registar **pagamento parcial**, ou remover.

## Estados

- **Pendente** — nada pago ainda
- **Parcial** — pago em parte (mostra quanto falta)
- **Pago** — saldado

## Testar o endpoint

```bash
curl -X POST "https://piquet-dashboard.vercel.app/api/webhooks/outlook-invoice?key=617a512aadd4dd558d58d9b1e2f0ca66ee1e6494ae37fb67" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Fatura EDP julho","from":"faturas@edp.pt","attachmentName":"fatura.pdf"}'
```
