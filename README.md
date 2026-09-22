# Meu Bolso Digital

Aplicação web de controle financeiro pessoal: registro de receitas e despesas, categorias,
metas e relatórios, com indicadores visuais para acompanhar a situação financeira.

Frontend estático (HTML, CSS e JavaScript puro, sem build) hospedado na Vercel. Backend
próprio em Node.js e Express, com banco de dados PostgreSQL próprio. Sem Supabase: toda
comunicação entre o frontend e o banco passa pela API do backend.

## Status do desenvolvimento

O projeto é construído por fases, conforme o documento de desenvolvimento original, validando
cada etapa antes de avançar para a próxima.

| Fase | Entrega | Situação |
|---|---|---|
| 1 | Estrutura (frontend, backend, banco) | Pronta |
| 2 | Autenticação (cadastro, login, sessão, hash de senha) | Pronta |
| 3 | Receitas, despesas, categorias, movimentações, saldo | Pronta |
| 4 | Dashboard e gráficos | Pronta |
| 5 | Metas financeiras | Pronta |
| 6 | Relatórios | Pronta |
| 7 | PWA (instalação, ícone, modo offline) | Pronta |
| 8 | Segurança adicional (revisão de permissões) | Parcial (veja abaixo) |
| 9 | Deploy (Vercel, backend, banco, domínio) | Pronta (veja "No ar" abaixo) |
| 10 | Testes finais de tudo | Parcial (68 testes automatizados + fluxo completo verificado em produção) |

## No ar

- **App**: https://meu-bolso-digital-web.vercel.app
- **API**: https://backend-production-827d.up.railway.app/api (Railway; não acesse direto, é só pro frontend)
- Frontend na Vercel (conta `lindersonmanoel`, deploy automático a cada push no GitHub).
  Backend + PostgreSQL no Railway (mesma conta), no plano gratuito de créditos - sem domínio
  próprio por enquanto (ficou combinado usar só os endereços padrão da Vercel/Railway).
- Repositório: https://github.com/lindersonmanoel/meubolsodigital

## O que já está entregue (Fases 1 a 7)

- Cadastro de conta, login com token JWT e sessão mantida no navegador (localStorage), com
  redirecionamento automático (quem não está logado não acessa o app; quem já está logado não
  vê login/cadastro de novo).
- Perfil: trocar nome/e-mail (`PUT /api/users/me`) e trocar senha (`PUT /api/users/senha`).
- **Categorias**: criar, editar e excluir, por tipo (receita/despesa), sem duplicar nome+tipo.
- **Receitas, despesas e movimentações**: cadastro com descrição, valor, data, categoria
  opcional e observação; edição; exclusão; filtros por tipo, categoria, período e busca por
  descrição. `/api/receitas` e `/api/despesas` são atalhos pré-filtrados de `/api/movimentacoes`.
- **Dashboard**: cartões de saldo atual, receitas do mês, despesas do mês e resultado do mês;
  gráfico de barras (receitas x despesas dos últimos 6 meses) e gráfico de rosca (despesas por
  categoria no mês), com Chart.js.
- **Metas financeiras**: valor objetivo, valor já guardado, prazo opcional, barra de progresso
  (nunca passa de 100%, mesmo ultrapassando o objetivo).
- **Relatórios**: totais de receitas/despesas, saldo e categoria com maior gasto num período
  escolhido, com tabela de despesas por categoria.
- **PWA**: `manifest.json` + service worker (guarda a interface em cache pra abrir rápido e
  funcionar offline; nunca guarda dados financeiros da API em cache).
- Navegação por menu lateral (colapsa em menu deslizante no celular) em todas as telas logadas.
- Segurança desde a base: senha com hash (bcrypt), limite de tentativas por IP, CORS restrito,
  cabeçalhos de segurança (Helmet), corpo de requisição limitado, mensagens de erro que nunca
  revelam detalhe interno, e cada usuário só acessa os próprios dados (toda consulta filtrada
  pelo `usuario_id` do token, nunca por um valor vindo do cliente).

## Estrutura do projeto

```
MeuBolsoDigital/
├── frontend/            HTML, CSS e JS puro (sem build), pronto pra Vercel
│   ├── index.html        redireciona pra login ou dashboard conforme a sessão
│   ├── login.html, cadastro.html
│   ├── dashboard.html    cartões + gráficos (Chart.js)
│   ├── categorias.html, movimentacoes.html, receitas.html, despesas.html
│   ├── metas.html, relatorios.html, configuracoes.html
│   ├── manifest.json, service-worker.js   PWA
│   ├── css/               global.css, layout.css, shell.css (menu lateral/tabelas), responsive.css
│   ├── js/                 api.js (cliente HTTP), auth.js (sessão), shell.js (menu lateral),
│   │                        movimentacoes.js (motor de receitas/despesas/movimentações),
│   │                        pwa.js (registra o service worker), config.js (endereço da API)
│   ├── assets/images/     logo.png
│   └── vercel.json        cabeçalhos de segurança pro deploy
├── backend/              API Node.js + Express
│   ├── src/
│   │   ├── controllers/, routes/, services/, middleware/, models/, database/, utils/
│   │   ├── app.js         monta o Express (usado pelos testes, sem abrir porta)
│   │   ├── config.js      lê e valida as variáveis de ambiente
│   │   └── server.js      ponto de entrada (sobe o servidor de verdade)
│   ├── tests/             Jest + Supertest (68 testes)
│   ├── .env.example
│   └── package.json
├── database/migrations/   SQL versionado (001_init.sql cria as 4 tabelas)
├── docker-compose.yml     PostgreSQL local pra desenvolvimento/teste
└── README.md
```

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

Aplique a migração e suba a API:

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

Antes da primeira vez, aplique a migração no banco de teste também (é um banco separado do
de desenvolvimento, criado no passo 1):

```bash
cd backend
node -e "require('dotenv').config({path:'.env.test'}); require('./src/database/migrate').run()"
npm test
```

68 testes (Jest + Supertest), rodando contra um PostgreSQL de teste de verdade (aponte
`backend/.env.test` pro seu banco de teste; por padrão usa o mesmo Docker acima). Cobre
cadastro, login, troca de senha, validação de campos, hash de senha, rota protegida,
atualização de perfil, categorias, receitas/despesas/movimentações (com filtros), metas
(incluindo o teto de 100% de progresso), dashboard, relatórios, CORS, limite de tentativas,
isolamento entre usuários (cada pessoa só vê e mexe nos próprios dados) e erros tratados
(404, JSON inválido, IDs inválidos) sem vazar detalhe interno. Rode com `npm test` (usa
`--runInBand`: os testes truncam as tabelas entre si, então precisam rodar em série, não em
paralelo). O fluxo completo (cadastro → login → categoria → receita/despesa → dashboard →
meta → relatório → troca de senha) também foi verificado de ponta a ponta contra a API real.

## Variáveis de ambiente (backend)

| Variável | Obrigatória em produção | Descrição |
|---|---|---|
| `NODE_ENV` | - | `development`, `production` ou `test` |
| `PORT` | - | Porta da API (padrão 3000) |
| `DATABASE_URL` | Sim | Conexão com o PostgreSQL |
| `DATABASE_SSL` | - | `true` se o banco gerenciado exigir SSL |
| `JWT_SECRET` | Sim | Segredo que assina os tokens de login. Gere um valor aleatório forte. |
| `JWT_EXPIRES_IN` | - | Validade do token (padrão `7d`) |
| `FRONTEND_URL` | Sim | Endereço do frontend, liberado no CORS |

O `.env` nunca deve ir para o Git (já está no `.gitignore`). Em produção, sem essas três
variáveis obrigatórias preenchidas, o servidor recusa iniciar.

## Segurança

- Senhas com hash bcrypt (12 rounds), nunca guardadas nem devolvidas em texto puro.
- JWT sem estado; o segredo (`JWT_SECRET`) precisa ser forte e exclusivo de cada ambiente.
- Limite de tentativas de cadastro/login por IP (`express-rate-limit`), contra força bruta.
- Mensagem de erro de login genérica ("e-mail ou senha inválidos"): não revela se o e-mail
  existe, evitando que alguém descubra contas cadastradas só tentando login.
- CORS restrito ao `FRONTEND_URL` configurado; cabeçalhos de segurança via Helmet.
- Corpo de requisição limitado a 100 KB; erro de JSON malformado tratado (não derruba a API).
- Erros não mapeados nunca vazam detalhe interno (consulta SQL, stack trace) para o cliente.
- Cada usuário só acessa os próprios dados: toda consulta ao banco já nasce filtrada pelo
  `usuario_id` extraído do token (`req.usuarioId`), nunca de um valor enviado pelo cliente.
- Pendente pra quando o projeto for exposto na internet de verdade (fase de deploy): HTTPS
  de ponta a ponta (a Vercel já entrega isso no frontend; o backend precisa de um provedor
  com HTTPS ou um proxy reverso na frente) e revisão de permissões antes de cada nova fase.

## Deploy (como está publicado hoje)

- **Frontend**: repositório no GitHub (`lindersonmanoel/meubolsodigital`) → projeto na Vercel
  com **Root Directory = `frontend`** (é aí que fica o `vercel.json` com os cabeçalhos de
  segurança) → deploy automático a cada push na branch principal.
- **Backend + banco**: Railway (projeto `meu-bolso-digital`), dois serviços - `backend`
  (builda pelo `Dockerfile` da raiz do repositório) e `Postgres` (na rede interna do Railway,
  sem porta pública exposta). Variáveis de ambiente configuradas direto no serviço `backend`
  (`railway variables --service backend`), com `DATABASE_URL` referenciando o Postgres
  (`${{Postgres.DATABASE_URL}}`) e `JWT_SECRET` gerado só pra produção.
- **Domínio**: por decisão do projeto, ficou nos endereços padrão (`*.vercel.app` e
  `*.up.railway.app`), sem domínio próprio por enquanto.
- **Atualizar o deploy depois de mudar o código**:
  ```bash
  cd backend && npx @railway/cli up --service backend --detach   # backend
  cd ../frontend && npx vercel --prod --yes                       # frontend (ou so' git push, o deploy automatico cuida disso)
  ```
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

Com as Fases 1 a 9 entregues (auth, receitas/despesas/categorias/movimentações, dashboard,
metas, relatórios, PWA e deploy), falta:

- **Fase 8** (rótulo do documento original, mas cabe revisitar periodicamente): uma nova
  revisão de segurança agora que existem mais rotas autenticadas (já seguem o mesmo padrão de
  isolamento por `usuario_id` das rotas anteriores, mas vale conferir de novo de tempos em
  tempos, sobretudo antes de expor a um público maior ou trocar pra domínio próprio).
- **Fase 10**: mais testes automatizados cobrindo o ambiente de produção (hoje o fluxo
  completo já foi verificado manualmente contra o Railway/Vercel reais, mas ainda não faz
  parte da suíte automatizada do CI).
- Domínio próprio (`lumvix.com.br` ou outro) e transferir os projetos Vercel/Railway pra
  conta definitiva, se um dia fizer sentido sair dos endereços padrão.
