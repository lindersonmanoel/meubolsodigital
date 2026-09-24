# Como manter o Meu Bolso Digital em dia

O app se explica em vários lugares (subtítulos, tour, novidades, README). Para que todos digam a **mesma coisa que o app
faz hoje**, cada mudança de funcionalidade passa por este checklist. Os testes em `e2e/tests/descricoes.spec.js` reprovam o
que puder ser verificado automaticamente.

## Onde ficam as descrições

| O quê | Onde | Quem confere |
|---|---|---|
| Descrição da página (busca, prévia de link) | `<meta name="description">` em cada `frontend/*.html` | teste E2E: existe, é única e tem 40 a 160 caracteres |
| Subtítulo de cada tela (o texto embaixo do título) | primeiro `<p class="hint">` de cada tela | teste E2E: preenchido em todas as telas do menu |
| Tour guiado | `PASSOS` em `frontend/js/tour.js` | teste E2E: toda tela do menu tem passo, o elemento destacado existe e o tour completo roda até o fim |
| Versão e "o que mudou" | `frontend/js/versao.js` (`APP_VERSION` + `CHANGELOG`) | teste E2E: a versão é a primeira do histórico; aparece em Configurações > Novidades e no aviso de atualização |
| Lista de funcionalidades | seção "Funcionalidades" do `README.md` | revisão no pull request (checklist) |
| Instruções de instalar o app | cartão "Instalar o app" em `frontend/configuracoes.html` | revisão |

## Ao mudar uma funcionalidade

1. Atualize o **subtítulo** da tela e a **meta description** da página se o que ela faz mudou.
2. Ajuste o **passo do tour** dessa tela (`frontend/js/tour.js`) - o texto deve citar o que a tela faz **agora**.
3. Registre em `frontend/js/versao.js`: suba a versão (`1.9.2` -> `1.9.3` para ajuste; `1.10.0` para funcionalidade nova),
   acrescente uma entrada no topo do `CHANGELOG` com data e 1 a 3 frases claras (sem jargão) e, se quiser que quem já usa o
   app receba o aviso, suba também `CACHE_NAME` em `frontend/service-worker.js`.
4. Atualize o **README** (Funcionalidades) se for algo novo ou que mudou de comportamento.
5. Rode os testes (`cd backend && npm test`; `cd e2e && npm test`) e abra o pull request: o modelo já traz o checklist.

## Tela nova

Adicione a entrada em `NAV_ITENS` (`frontend/js/shell.js`), um passo no tour, subtítulo e meta description, o arquivo no
`ARQUIVOS_ESSENCIAIS` do `service-worker.js` e um teste E2E. Sem isso os testes de descrição reprovam.

## Antes de publicar

- Endereço da API mudou? Atualize `frontend/js/config.js` **e** o `connect-src` em `frontend/vercel.json`.
- Mudou o banco? Nova migração em `database/migrations/` e, antes de publicar, ensaie na cópia do banco:
  `bash scripts/ensaiar-migracoes.sh backup.dump`.
- Veja também `SEGURANCA.md` (rotina mensal e checklist para novas rotas) e `DEPLOY.md`.
