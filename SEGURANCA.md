# Revisão de segurança periódica

O app guarda dados financeiros de pessoas. Esta rotina mantém a segurança em dia conforme ele ganha
rotas e funcionalidades. O que é automático roda no GitHub Actions; o resto é um roteiro curto.

## O que já roda sozinho

| O quê | Quando | Onde | Falha quando |
|---|---|---|---|
| Testes do backend (Jest + PostgreSQL) | a cada push e pull request | `.github/workflows/testes.yml` | qualquer teste quebra |
| Fumaça em produção (site + API) | todo dia, 09:17 UTC | `.github/workflows/smoke-producao.yml` | site/API fora do ar, CORS ou cabeçalhos errados |
| Auditoria de dependências e segredos | toda segunda, 08:00 UTC | `.github/workflows/seguranca.yml` | vulnerabilidade **alta/crítica** em dependência de produção, ou segredo no repositório |
| Atualizações de dependências | toda segunda (PRs) | `.github/dependabot.yml` | abre PR; a suíte de testes valida |

Rodar na mão: `node scripts/smoke-producao.js` (produção) e `bash scripts/verificar-segredos.sh`.

## Revisão mensal (30 min)

1. **Dependabot**: mesclar (ou justificar) os PRs abertos; conferir se a suíte passou.
2. **`cd backend && npm audit --omit=dev`**: anotar moderadas novas; alta/crítica se corrige na hora.
3. **Logs da API** (Railway/VM): procurar `[erro não tratado]`, `[email] falha` e picos de `429`/`401`.
4. **E-mail de recuperação**: pedir "esqueci minha senha" com uma conta real e confirmar que o e-mail chega.
   `GET /api/health/ready` mostra o estado (`"email":"smtp"` ou `"resend"` = ok; `resend_remetente_de_teste`,
   `smtp_sem_remetente` ou `sem_provedor` = **não entrega a todos**) e o smoke test diário avisa quando não está ok.
5. **Backup do banco**: conferir que o backup automático rodou e **restaurar em um banco de teste** de vez em quando.
6. **CSP**: a política está **aplicada** (`frontend/vercel.json`). Abrir o site com o console aberto e ver se há
   avisos `Refused to ...`. Próximo endurecimento: remover `'unsafe-inline'` do `script-src` movendo os scripts
   inline das páginas para arquivos `.js`. **Ao trocar o endereço da API, atualize o `connect-src`** (o smoke
   test diário reprova se a CSP não liberar a API).
7. **Acessos**: quem ainda tem acesso à Vercel, à Railway, ao GitHub, à Resend e à Cloudflare? Remover quem saiu.

## A cada 6 meses (ou quando alguém sai do projeto)

- Trocar `JWT_SECRET` (**desloga todo mundo**), a chave da Resend, a senha do banco e tokens de API.
- Revisar a política de senhas e o tempo de validade do token (`JWT_EXPIRES_IN`).

## Checklist para toda nova rota ou funcionalidade

- [ ] Usa `requireAuth` (a não ser que seja pública **de propósito**) e filtra **toda** consulta por `usuario_id` vindo do token, nunca do corpo/URL.
- [ ] Referências a outros registros (categoria etc.) são conferidas como sendo **do mesmo usuário**.
- [ ] Valida tipo, tamanho e limites (datas reais com `dataValida`, valores até `VALOR_MAXIMO`, textos com tamanho máximo). Entrada ruim = **422**, nunca 500.
- [ ] Consultas SQL **parametrizadas** (`$1`, `$2`); nada de concatenar texto do usuário.
- [ ] Tudo que o usuário digitou e vai para a tela usa `textContent` ou `escaparHtml` (nunca `innerHTML` direto).
- [ ] Operação cara (exportar, importar, relatório pesado) usa `limitePesado`; erros de negócio não vazam detalhes internos.
- [ ] Mudou senha, e-mail ou permissão? Pensar se as sessões existentes devem cair (`token_version`).
- [ ] Tem **teste automatizado** cobrindo o caso feliz, a validação e o isolamento entre usuários.
- [ ] Mudança de banco entra como **nova migração** (`database/migrations/00N_*.sql`), sem editar as antigas.

## Se algo der errado (suspeita de vazamento ou conta invadida)

1. **Derrubar todas as sessões**: `UPDATE usuarios SET token_version = token_version + 1;` no banco de produção
   (ou trocar o `JWT_SECRET`). Quem estiver logado terá que entrar de novo.
2. **Trocar** as chaves envolvidas (Resend, banco, `JWT_SECRET`) e redeployar.
3. Conferir os logs do período e avisar as pessoas afetadas (LGPD: prazo razoável e comunicação clara).
4. Registrar o que houve e criar um teste que teria pegado o problema.

## Boas práticas de segredos

- Nunca colar chaves em chat, issue, commit ou print. Se isso acontecer, **troque a chave** (rotacione) na hora.
- `.env*` reais ficam fora do git (só os `.example`); `scripts/verificar-segredos.sh` confere isso no CI.
- Tokens de API com **escopo mínimo** (ex.: Cloudflare só para o que o projeto usa) e com data para revisar.
