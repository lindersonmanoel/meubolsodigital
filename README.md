# Meu Bolso Digital

Aplicação web de controle financeiro pessoal: receitas, despesas, contas fixas recorrentes,
orçamento por categoria, metas e relatórios, com um dashboard visual pra acompanhar a situação
financeira de relance.

Frontend estático (HTML, CSS e JavaScript puro, sem build) hospedado na Vercel. Backend
próprio em Node.js e Express, com banco de dados PostgreSQL próprio, hospedado no Railway.
Sem Supabase: toda comunicação entre o frontend e o banco passa pela API do backend.

## No ar

- **App**: https://meu-bolso-digital-web.vercel.app
- **API**: https://backend-production-827d.up.railway.app/api (só pro frontend consumir, não é feita pra acesso direto)
- **Repositório**: https://github.com/lindersonmanoel/meubolsodigital
- Frontend na Vercel (deploy automático a cada push no GitHub). Backend + PostgreSQL no
  Railway (rede interna, sem porta pública exposta no banco). Endereços padrão das duas
  plataformas (`*.vercel.app` e `*.up.railway.app`), sem domínio próprio por enquanto.

## Funcionalidades

- **Conta e sessão**: cadastro, login com token JWT, "lembrar de mim" (sessão persiste ao
  fechar o navegador ou não, por escolha da pessoa), recuperação de senha por e-mail
  (link de uso único, válido por 1 hora, via Resend), trocar nome/e-mail, trocar senha,
  foto de perfil (recortada/redimensionada no navegador antes de enviar, guardada como
  base64 no banco - sem serviço de armazenamento externo) e bio curta.
- **Backup e restauração**: baixe um arquivo `.json` com tudo que você cadastrou
  (categorias, movimentações, metas, orçamentos, recorrências) e restaure depois - útil se
  perder dados por engano. Restaurar nunca apaga o que já existe (categorias repetidas são
  reaproveitadas pelo nome; o resto é adicionado).
- **Categorias**: criar, editar e excluir, separadas por tipo (receita/despesa). Não deixa
  duplicar nome+tipo, nem trocar o tipo de uma categoria que já tem movimentação, recorrência
  ou orçamento ligados a ela (evita dado inconsistente).
- **Receitas, despesas e movimentações**: cadastro com descrição, valor, data, categoria
  opcional e observação; edição; exclusão; filtros por tipo, categoria, período e busca por
  descrição; exportação em CSV.
- **Recorrências**: contas fixas (aluguel, salário, assinaturas) com dia do mês pra lançar -
  a movimentação do mês é gerada sozinha (sem duplicar) sempre que o dashboard é aberto.
- **Orçamentos**: limite de gasto mensal por categoria, com o quanto já foi gasto no mês,
  percentual e aviso quando fica perto ou passa do limite.
- **Dashboard**: saldo atual, receitas/despesas/resultado do mês, gráfico de barras (receitas
  x despesas dos últimos 6 meses) e gráfico de rosca (despesas por categoria no mês), com
  Chart.js.
- **Metas financeiras**: valor objetivo, valor já guardado, prazo opcional, barra de progresso
  (nunca passa de 100%, mesmo ultrapassando o objetivo).
- **Relatórios**: totais, saldo e categoria com maior gasto num período escolhido; exportação
  em CSV, PDF (via impressão do navegador) ou **Excel completo** (.xlsx de verdade, com
  formatação e várias abas: Resumo, Movimentações, Despesas por categoria, Metas e
  Orçamentos - tudo organizado automaticamente, sem precisar montar planilha na mão).
  Movimentações/receitas/despesas também exportam direto pra Excel.
- **PWA instalável**: em Android, iPhone/iPad, Windows e Mac. Botão "Instalar agora" quando o
  navegador oferece o instalador nativo, e passo a passo manual pra cada plataforma (inclui
  iPhone/iPad no Safari, que não tem instalador automático) - aparece no login, no cadastro e
  no dashboard. Funciona offline pra abrir rápido (nunca guarda dados financeiros em cache).
- **Tour guiado**: botão "?" sempre visível no topo, mostra uma explicação de cada tela
  principal, com destaque visual no elemento e navegação entre as páginas.
- **Aviso de atualização automática**: quando uma versão nova do app é publicada, quem já
  está usando (inclusive instalado) recebe um aviso com o número da versão e um resumo do
  que mudou, com um botão pra atualizar na hora (ver `js/versao.js` e `js/pwa.js`).
- Menu lateral (colapsa em menu deslizante no celular) em todas as telas logadas.

## Segurança

- Senhas com hash bcrypt (12 rounds), nunca guardadas nem devolvidas em texto puro.
- JWT sem estado; o segredo (`JWT_SECRET`) é forte e exclusivo de cada ambiente.
- Limite de tentativas de cadastro/login por IP (`express-rate-limit`), contra força bruta -
  já preparado pra rodar atrás de proxy (Railway) sem quebrar (`trust proxy`).
- Mensagem de erro de login genérica ("e-mail ou senha inválidos"): não revela se o e-mail
  existe. O pedido de recuperação de senha responde sempre com a mesma mensagem também,
  exista ou não a conta.
- Token de recuperação de senha: aleatório (32 bytes), guardado no banco só como hash
  (sha256, nunca em texto puro), de uso único e expira em 1 hora; pedir de novo invalida
  o link anterior.
- CORS restrito ao `FRONTEND_URL` configurado; cabeçalhos de segurança via Helmet; respostas
  comprimidas (gzip).
- Exportação em CSV protegida contra injeção de fórmula (um valor que comece com `=`, `+`,
  `-` ou `@` vem prefixado com apóstrofo, pra não virar fórmula executável se abrir no Excel).
- Corpo de requisição limitado a 1 MB; erro de JSON malformado tratado (não derruba a API).
- Erros não mapeados nunca vazam detalhe interno (consulta SQL, stack trace) para o cliente.
- Cada usuário só acessa os próprios dados: toda consulta ao banco já nasce filtrada pelo
  `usuario_id` extraído do token (`req.usuarioId`), nunca de um valor enviado pelo cliente.

## Estrutura do projeto

```
MeuBolsoDigital/
├── frontend/                HTML, CSS e JS puro (sem build), pronto pra Vercel
│   ├── index.html            redireciona pra login ou dashboard conforme a sessão
│   ├── login.html, cadastro.html
│   ├── dashboard.html        cartões + gráficos (Chart.js)
│   ├── categorias.html, movimentacoes.html, receitas.html, despesas.html
│   ├── recorrencias.html, orcamentos.html, metas.html, relatorios.html, configuracoes.html
│   ├── manifest.json, service-worker.js     PWA
│   ├── css/                  global.css, layout.css, shell.css (menu lateral/tabelas/tour/
│   │                          instalador), responsive.css, print.css (relatório em PDF)
│   ├── js/                   api.js (cliente HTTP), auth.js (sessão), shell.js (menu lateral),
│   │                          movimentacoes.js (motor de receitas/despesas/movimentações),
│   │                          pwa.js (service worker + instalador do app + aviso de
│   │                          atualização), tour.js (tour guiado), versao.js (número da
│   │                          versão + changelog), config.js (endereço da API)
│   ├── assets/images/        logo.png (marca completa), logo-icon.png (ícone redondo,
│   │                          usado no favicon/sidebar/instalação), logo-maskable.png
│   │                          (ícone adaptativo do Android)
│   └── vercel.json           cabeçalhos de segurança pro deploy
├── backend/                 API Node.js + Express
│   ├── src/
│   │   ├── controllers/, routes/, services/, middleware/, models/, database/, utils/
│   │   ├── app.js             monta o Express (usado pelos testes, sem abrir porta)
│   │   ├── config.js          lê e valida as variáveis de ambiente
│   │   └── server.js          ponto de entrada (sobe o servidor de verdade)
│   ├── tests/                 Jest + Supertest (rode `npm test` pra ver a contagem)
│   ├── .env.example
│   └── package.json
├── database/migrations/      SQL versionado, numerado em ordem (001_init.sql: usuários/categorias/
│                              movimentações/metas; 002: recorrências e orçamentos; 003: foto e bio;
│                              004: recuperação de senha; 005: categorias padrão; 006: versão do token
│                              (sessões); 007/008: recorrência sem duplicar e sem perder meses; 009: e-mail
│                              único sem diferenciar maiúsculas)
├── e2e/                       testes de navegador (Playwright): fluxos, layout de celular e segurança (ver e2e/README.md)
├── docker-compose.yml         PostgreSQL local pra desenvolvimento/teste
├── Dockerfile                 imagem de produção do backend (usada pelo Railway hoje)
├── docker-compose.prod.yml    stack alternativa pra VM própria (Postgres + backend + Cloudflare Tunnel)
├── .env.production.example    modelo de variáveis pra essa stack alternativa
├── DEPLOY.md                  roteiro da stack alternativa (VM + Docker + Cloudflare Tunnel)
└── README.md
```

## API (visão geral)

Tudo debaixo de `/api`, autenticado com `Authorization: Bearer <token>` (exceto onde marcado).

| Recurso | Rotas |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/esqueci-senha`, `POST /auth/redefinir-senha` *(essas 4, sem token)*, `GET /auth/me`, `POST /auth/logout` |
| Perfil | `PUT /users/me`, `PUT /users/senha` |
| Categorias | `GET/POST /categorias`, `PUT/DELETE /categorias/:id` |
| Movimentações | `GET/POST /movimentacoes`, `PUT/DELETE /movimentacoes/:id`, `GET /movimentacoes/exportar` (CSV), `GET /movimentacoes/exportar-excel` (.xlsx) |
| Receitas / Despesas | iguais a movimentações, em `/receitas` e `/despesas` (tipo já vem fixo) |
| Recorrências | `GET/POST /recorrencias`, `PUT/DELETE /recorrencias/:id` |
| Orçamentos | `GET/POST /orcamentos`, `PUT/DELETE /orcamentos/:id` |
| Metas | `GET/POST /metas`, `PUT/DELETE /metas/:id` |
| Backup | `GET /backup` (baixa tudo em .json), `POST /backup/restaurar` (importa um arquivo de backup) |
| Dashboard | `GET /dashboard/resumo`, `GET /dashboard/graficos` |
| Relatórios | `GET /relatorios`, `GET /relatorios/exportar` (CSV), `GET /relatorios/exportar-excel` (.xlsx completo, várias abas) |
| Saúde | `GET /health` *(sem token)* |

## Como rodar localmente

### 1. Banco de dados

```bash
docker compose up -d
```

Sobe um PostgreSQL em `localhost:55432` (usuário `mbd`, senha `mbd_local_dev`), com os dados
guardados num volume Docker (sobrevivem a reinícios). O container cria sozinho o banco
`meu_bolso_digital` (desenvolvimento); crie também o de teste, uma vez só:

```bash
docker compose exec postgres psql -U mbd -d postgres -c "CREATE DATABASE meu_bolso_digital_test;"
```

**Importante: nunca aponte `backend/.env` (desenvolvimento) e `backend/.env.test` para o
mesmo banco.** Os testes automatizados apagam (`TRUNCATE`) as tabelas antes de cada teste -
se apontarem pro mesmo banco, `npm test` apaga as contas que você criou testando na mão.

### 2. Backend

```bash
cd backend
npm install
copy .env.example .env    # Linux/macOS: cp .env.example .env
```

Edite o `.env`: aponte `DATABASE_URL` pro banco acima (ou outro PostgreSQL seu) e gere um
`JWT_SECRET` forte:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Aplique as migrações e suba a API:

```bash
npm run migrate
npm run dev
```

A API sobe em `http://localhost:3000`. Confira com `curl http://localhost:3000/api/health`.

### 3. Frontend

Sem build. Sirva a pasta `frontend/` com qualquer servidor estático, por exemplo a extensão
**Live Server** do VS Code, ou:

```bash
npx serve frontend -l 5500
```

Abra `http://localhost:5500` (ou o endereço mostrado). Se usar outra porta, atualize
`FRONTEND_URL` no `backend/.env` pra combinar (senão o CORS bloqueia as requisições).

### 4. Testes automatizados

Antes da primeira vez, aplique as migrações no banco de teste também (é um banco separado do
de desenvolvimento, criado no passo 1):

```bash
cd backend
node -e "require('dotenv').config({path:'.env.test'}); require('./src/database/migrate').run()"
npm test
```

Testes automatizados (Jest + Supertest), rodando contra um PostgreSQL de teste de verdade. Cobre
cadastro, login, troca de senha, validação de campos, hash de senha, rota protegida,
atualização de perfil, categorias (incluindo o bloqueio de trocar tipo em uso), receitas/
despesas/movimentações (com filtros e exportação CSV), recorrências (geração automática sem
duplicar), orçamentos (percentual e situação), metas (com o teto de 100% de progresso),
dashboard, relatórios, proteção contra injeção de fórmula no CSV, CORS, limite de tentativas,
isolamento entre usuários (cada pessoa só vê e mexe nos próprios dados) e erros tratados sem
vazar detalhe interno. Rode com `npm test` (usa `--runInBand`: os testes truncam as tabelas
entre si, então precisam rodar em série, não em paralelo).

## Variáveis de ambiente (backend)

| Variável | Obrigatória em produção | Descrição |
|---|---|---|
| `NODE_ENV` | - | `development`, `production` ou `test` |
| `PORT` | - | Porta da API (padrão 3000) |
| `DATABASE_URL` | Sim | Conexão com o PostgreSQL |
| `DATABASE_SSL` | - | `true` se o banco gerenciado exigir SSL |
| `DATABASE_SSL_CA` | - | Certificado (PEM) da CA do provedor, para validar a conexão SSL com o banco. Sem isso, `DATABASE_SSL=true` conecta sem verificar a cadeia (comum em Railway/Heroku) |
| `JWT_SECRET` | Sim | Segredo que assina os tokens de login. Gere um valor aleatório forte. |
| `JWT_EXPIRES_IN` | - | Validade do token (padrão `7d`) |
| `FRONTEND_URL` | Sim | Endereço do frontend, liberado no CORS e usado no link do e-mail de recuperação de senha |
| `RESEND_API_KEY` | - | Chave da API do [Resend](https://resend.com), para enviar o e-mail de "esqueci minha senha". Sem isso, o link fica só no log do servidor |
| `EMAIL_FROM` | - | Remetente do e-mail de recuperação de senha (padrão `onboarding@resend.dev`, funciona sem domínio próprio verificado) |

O `.env` nunca deve ir para o Git (já está no `.gitignore`). Em produção, sem essas três
variáveis obrigatórias preenchidas, o servidor recusa iniciar.

## Deploy (como está publicado hoje)

- **Frontend**: repositório no GitHub (`lindersonmanoel/meubolsodigital`) → projeto na Vercel
  com **Root Directory = `frontend`** (é aí que fica o `vercel.json` com os cabeçalhos de
  segurança) → deploy automático a cada push na branch principal.
- **Backend + banco**: Railway (projeto `meu-bolso-digital`), dois serviços - `backend`
  (builda pelo `Dockerfile` da raiz do repositório) e `Postgres` (na rede interna do Railway,
  sem porta pública exposta). Variáveis de ambiente configuradas direto no serviço `backend`
  (`railway variables --service backend`), com `DATABASE_URL` referenciando o Postgres
  (`${{Postgres.DATABASE_URL}}`) e `JWT_SECRET` gerado só pra produção.
- **Atualizar o deploy depois de mudar o código**: o normal é só `git push` (Vercel e Railway
  têm deploy automático a cada push). Pra forçar manualmente sem esperar o push:
  ```bash
  npx @railway/cli up --service backend --detach   # backend, roda de qualquer pasta do repo
  npx vercel --prod --yes                          # frontend - roda da RAIZ do repositório
  ```
  Importante: o deploy manual do frontend precisa rodar da raiz do projeto (não de dentro de
  `frontend/`), porque o Root Directory já está configurado como `frontend` no projeto Vercel -
  rodar de dentro da pasta duplicaria o caminho e o build não encontra os arquivos.
- **Migração em produção** (só quando uma migração nova for adicionada em
  `database/migrations/`): como o Postgres do Railway só tem rede interna, crie um proxy TCP
  temporário, rode a migração local apontando pra ele e depois apague o proxy:
  ```bash
  npx @railway/cli tcp-proxy create --port 5432 --service Postgres --json
  # copie host/porta do retorno pro DATABASE_URL abaixo (senha igual a do Postgres)
  cd backend
  $env:DATABASE_URL = "postgresql://postgres:SENHA@HOST:PORTA/railway"; $env:DATABASE_SSL = "true"
  node src/database/migrate.js
  npx @railway/cli tcp-proxy delete <id-do-proxy> --service Postgres --yes
  ```

Uma alternativa que fica documentada mas não foi usada nesta publicação (padrão dos outros
projetos, pra quando fizer sentido migrar pra infraestrutura própria): backend numa VM com
Docker + Cloudflare Tunnel, usando `Dockerfile`, `docker-compose.prod.yml` e o roteiro
completo em [`DEPLOY.md`](DEPLOY.md).

## Próximos passos

- Domínio próprio e transferir os projetos Vercel/Railway pra conta definitiva, se um dia
  fizer sentido sair dos endereços padrão.
- Mais testes automatizados cobrindo o ambiente de produção direto (hoje o fluxo é verificado
  manualmente contra o Railway/Vercel reais a cada mudança, mas ainda não faz parte de um CI).
- Revisão de segurança periódica conforme o app ganha mais rotas/funcionalidades.
