## O que muda

<!-- Em uma ou duas frases: o que esta mudança faz e por quê. -->

## Checklist

- [ ] Rodei os testes: `cd backend && npm test` e, se mexi no site, `cd e2e && npm test` (o CI também roda).
- [ ] **Mudou algo que a pessoa vê ou faz?** Atualizei as descrições do app (detalhes em `CONTRIBUINDO.md`):
  - [ ] subtítulo da tela e `<meta name="description">` da página;
  - [ ] passo do tour em `frontend/js/tour.js` (e o texto, se a funcionalidade mudou);
  - [ ] `frontend/js/versao.js`: nova versão + o que mudou (aparece no aviso de atualização e em Configurações > Novidades);
  - [ ] seção "Funcionalidades" do `README.md`.
- [ ] **Tela nova?** Entrada no menu (`frontend/js/shell.js`), passo no tour, descrição, pré-cache no `service-worker.js` e teste E2E.
- [ ] **Banco?** Nova migração em `database/migrations/` (nunca editar as antigas); avisei se ela pode falhar em dados existentes.
- [ ] **Endereço da API mudou?** Atualizei `frontend/js/config.js` **e** o `connect-src` da CSP em `frontend/vercel.json`.
- [ ] Nenhuma credencial, chave ou `.env` no commit.

## Como verificar

<!-- Passos para testar na mão (ou "coberto pelos testes automatizados"). -->
