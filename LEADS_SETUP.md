# Ligar o formulário da landing ao backoffice

O backoffice recebe leads em `POST https://piquet-dashboard.vercel.app/api/leads`
(endpoint público, com CORS aberto — funciona a partir de piquetapp.com ou
qualquer domínio). As leads aparecem em **Marketing → CRM & Leads**.

Cada pedido entra no estado **"Não iniciado"**. No CRM, muda-se o estado à medida
que avança: **Não iniciado → Orçamento enviado → Orçamento aceite → Recusado → Concluído**.

## Campos aceites (JSON)

| Campo     | Obrigatório | Máx.  | Notas                                   |
|-----------|-------------|-------|-----------------------------------------|
| `name`    | ¹           | 200   |                                         |
| `email`   | ¹           | 200   |                                         |
| `phone`   | ¹           | 50    |                                         |
| `city`    | não         | 100   |                                         |
| `message` | não         | 2000  |                                         |
| `source`  | não         | 100   | default `website`; usar p.ex. `landing` |
| `website` | —           | —     | **honeypot** — deixar SEMPRE vazio      |

¹ Pelo menos um de `name`/`email`/`phone` é obrigatório (senão HTTP 400).

## Snippet para o formulário

```html
<!-- No <form>, adiciona um honeypot invisível (os bots preenchem-no): -->
<input type="text" name="website" tabindex="-1" autocomplete="off"
       style="position:absolute;left:-9999px" aria-hidden="true" />
```

```js
async function enviarLead(form) {
  const dados = Object.fromEntries(new FormData(form));
  const res = await fetch("https://piquet-dashboard.vercel.app/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: dados.name,
      email: dados.email,
      phone: dados.phone,
      city: dados.city,
      message: dados.message,
      source: "landing",
      website: dados.website, // honeypot — vem vazio de humanos
    }),
  });
  return res.ok; // true → mostrar "obrigado"; false → mostrar erro
}
```

## Respostas

- `201 {"ok":true}` — lead guardada.
- `200 {"ok":true}` — honeypot preenchido (bot); nada foi guardado.
- `400` — sem nome/email/telefone, ou JSON inválido.

## Teste rápido

```bash
curl -X POST https://piquet-dashboard.vercel.app/api/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","email":"teste@exemplo.pt","source":"landing"}'
```

## Snippet EXATO para o formulário atual da piquetapp.com

O formulário da landing (`#serviceForm`) hoje só abre o WhatsApp. Cola este bloco
**antes de `</body>`** e cada pedido passa a ficar registado no CRM ao submeter —
sem mexer no comportamento atual do WhatsApp (corre em paralelo, com `keepalive`
para o pedido chegar mesmo com a navegação para o wa.me).

```html
<script>
(function () {
  var form = document.getElementById('serviceForm');
  if (!form) return;
  form.addEventListener('submit', function () {
    var hp = document.getElementById('f-website');
    if (hp && hp.value) return; // honeypot preenchido → é bot, não regista
    var txt = function (id) { var el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
    var opt = function (id) { var el = document.getElementById(id); return (el && el.selectedOptions && el.selectedOptions[0]) ? el.selectedOptions[0].text.trim() : txt(id); };
    var msg = 'Serviço: ' + opt('f-service') + ' · Urgência: ' + opt('f-urgency') + '\n' + txt('f-desc');
    try {
      fetch('https://piquet-dashboard.vercel.app/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true, // garante o envio mesmo quando abre o WhatsApp
        body: JSON.stringify({
          name: txt('f-name'),
          city: txt('f-location'),
          message: msg,
          source: 'landing',
          website: hp ? hp.value : ''
        })
      });
    } catch (e) {}
  });
})();
</script>
```

> O formulário atual **não tem campo de telefone/email** — a lead entra com nome,
> cidade e o pedido, mas sem número de contacto (o número só chega quando o
> cliente envia o WhatsApp, e aí vai para o telemóvel). Para teres um número no
> CRM, acrescenta um campo `<input id="f-phone">` ao formulário e junta
> `phone: txt('f-phone')` ao `body` acima.

## Variante: registar E abrir o WhatsApp (click-to-chat)

Se o botão da landing leva o cliente para o WhatsApp, regista-se o pedido no
backoffice **e** abre-se a conversa, tudo no mesmo submit:

```js
async function pedirServico(form) {
  const d = Object.fromEntries(new FormData(form));
  // 1) regista no backoffice (não bloqueia se falhar)
  fetch("https://piquet-dashboard.vercel.app/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: d.name, phone: d.phone, city: d.city, message: d.message, source: "landing" }),
  }).catch(() => {});
  // 2) abre o WhatsApp da Piquet com o pedido pré-preenchido
  const texto = `Olá! Sou ${d.name}. Preciso de: ${d.message} (${d.city}).`;
  const NUMERO = "3519XXXXXXXX"; // nº WhatsApp da Piquet, formato internacional sem +
  window.location.href = `https://wa.me/${NUMERO}?text=${encodeURIComponent(texto)}`;
}
```

# Receber pedidos por WhatsApp (Meta Cloud API)

Para que **mensagens recebidas** no WhatsApp da Piquet entrem sozinhas no CRM
(sem passar pela landing), liga-se a WhatsApp Cloud API ao webhook do backoffice:

```
POST/GET  https://piquet-dashboard.vercel.app/api/webhooks/whatsapp
```

Cada mensagem cria uma lead com `source: "whatsapp"` e estado **"Não iniciado"**
(nome = perfil do WhatsApp, telefone = número, pedido = texto da mensagem).

### Passos (Meta for Developers)

1. **App + produto WhatsApp** — em [developers.facebook.com](https://developers.facebook.com),
   cria uma app e adiciona o produto **WhatsApp**; associa o número da Piquet.
2. **Variáveis na Vercel** (Project → Settings → Environment Variables):
   - `WHATSAPP_VERIFY_TOKEN` — uma frase à tua escolha (ex.: `piquet-wa-2026`).
   - `WHATSAPP_APP_SECRET` — *App Secret* da app Meta (opcional, mas recomendado:
     valida a assinatura das mensagens). Re-deploy após adicionar.
3. **Configurar o webhook** — em WhatsApp → *Configuration* → *Webhook*:
   - **Callback URL:** `https://piquet-dashboard.vercel.app/api/webhooks/whatsapp`
   - **Verify token:** o mesmo valor de `WHATSAPP_VERIFY_TOKEN`.
   - Clica **Verify and save** (a Meta faz um GET de verificação — deve dar ✓).
4. **Subscrever** ao campo **`messages`**.
5. **Testar** — envia uma mensagem para o número da Piquet; deve aparecer em
   **Marketing → CRM & Leads** em segundos.

> Nota: o número tem de estar em **WhatsApp Business Platform (Cloud API)**. Um
> WhatsApp Business "normal" (app do telemóvel) não expõe webhooks — nesse caso
> usa a variante click-to-chat acima (a landing regista, o WhatsApp só conversa).
