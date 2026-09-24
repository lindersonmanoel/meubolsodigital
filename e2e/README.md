# Testes de navegador (E2E)

Testes com Playwright + Chromium que abrem o site de verdade, como uma pessoa usaria, em **desktop** e em
**celular** (iPhone 13, Pixel 5 e uma tela estreita de 320 px). Cobrem:

| Arquivo | O que verifica |
|---|---|
| `tests/fluxo.spec.js` | cadastro e login pela tela, criar/excluir despesa, excluir categoria em uso (com aviso), troca de senha (errar a senha atual não desloga), tour só abre pelo botão `?` |
| `tests/mobile.spec.js` | sem rolagem lateral em todas as telas, tabelas viram cartões (Valor e Editar/Excluir visíveis), alvos de toque ≥ 40 px, menu lateral, teclado numérico nos campos de valor, PWA (ícones 192/512, área segura), Chart.js local |
| `tests/seguranca.spec.js` | Content-Security-Policy aplicada e sem violações nas telas, XSS via e-mail neutralizado, cabeçalhos de segurança, token fora da barra de endereço |

Os testes sobem sozinhos o **backend** (`backend/src/server.js`, `NODE_ENV=test`) e o **site estático** com os mesmos cabeçalhos do
`frontend/vercel.json` (o `gerar-serve-json.js` cria o `serve.json`, então a CSP é exercitada de verdade). Cada teste cria a própria conta.

## Rodar localmente

Precisa de um PostgreSQL com as migrações aplicadas (por exemplo o do `docker-compose.yml`).

```bash
# 1) banco de teste com as migrações
cd backend && npm ci
export DATABASE_URL=postgresql://mbd:mbd_local_dev@localhost:55432/meu_bolso_digital
npm run migrate

# 2) E2E
cd ../e2e && npm ci
npm run instalar-navegador      # baixa o Chromium (uma vez)
npm test                        # tudo
npm run test:mobile             # só os projetos de celular
npx playwright test --ui        # modo interativo
```

No GitHub Actions o workflow `.github/workflows/e2e.yml` faz tudo isso a cada push e pull request e guarda o relatório HTML
quando algo falha (aba *Artifacts* da execução).

> Ao trocar o endereço da API de produção, atualize também o `connect-src` da CSP no `frontend/vercel.json`; estes testes
> reprovam se a política bloquear alguma chamada do app.
