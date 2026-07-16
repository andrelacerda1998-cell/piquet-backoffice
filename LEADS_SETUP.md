# Ligar o formulário da landing ao backoffice

O backoffice recebe leads em `POST https://piquet-dashboard.vercel.app/api/leads`
(endpoint público, com CORS aberto — funciona a partir de piquetapp.com ou
qualquer domínio). As leads aparecem em **Marketing → CRM & Leads**.

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
