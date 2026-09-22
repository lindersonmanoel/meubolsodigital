# Deploy do backend (VM com Docker + Cloudflare Tunnel)

Este roteiro sobe o backend + PostgreSQL na sua VM, sem abrir nenhuma porta no firewall:
tudo passa pelo Cloudflare Tunnel, do mesmo jeito que os outros projetos.

Domínio final: `https://api.meubolso.lumvix.com.br` (o frontend já está publicado em
`https://meu-bolso-digital.vercel.app`, com o plano de apontar `meubolso.lumvix.com.br`
depois).

## 1. Clonar o projeto na VM

```bash
git clone https://github.com/lindersonmanoel/meubolsodigital.git
cd meubolsodigital
```

## 2. Criar o `.env.production`

```bash
cp .env.production.example .env.production
```

Edite `.env.production` e preencha de verdade:

- `POSTGRES_PASSWORD`: uma senha forte só sua (não reaproveite de outro projeto).
- `DATABASE_URL`: troque a senha nela pra ser **igual** ao `POSTGRES_PASSWORD` acima
  (o resto - `postgres:5432/meu_bolso_digital` - já está certo, é o nome do serviço Docker).
- `JWT_SECRET`: gere com:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `FRONTEND_URL`: `https://meu-bolso-digital.vercel.app` por enquanto (ou já
  `https://meubolso.lumvix.com.br` se o domínio próprio já estiver apontado nessa hora).
- `CLOUDFLARE_TUNNEL_TOKEN`: vem do passo 3 abaixo.

## 3. Criar o Cloudflare Tunnel (uma vez só)

No painel da Cloudflare (`dash.cloudflare.com` → **Zero Trust** → **Networks** → **Tunnels**):

1. **Create a tunnel** → tipo *Cloudflared* → nome `meu-bolso-digital-api`.
2. A tela seguinte mostra um comando `docker run cloudflare/cloudflared ... run --token eyJ...`.
   Copie só o valor depois de `--token` (uma string longa) e cole em `CLOUDFLARE_TUNNEL_TOKEN`
   no `.env.production`.
3. Ainda nessa tela, em **Public Hostname**, adicione:
   - Subdomain: `api.meubolso`
   - Domain: `lumvix.com.br`
   - Service Type: `HTTP`
   - URL: `backend:3000` (nome do serviço Docker + porta interna, não `localhost`)
4. Salve. A Cloudflare já cria sozinha o registro DNS `api.meubolso.lumvix.com.br` apontando
   pro tunnel (não precisa mexer no DNS manualmente pra essa parte).

## 4. Subir tudo

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Isso sobe 3 containers: `meu-bolso-digital-db-prod` (Postgres), `meu-bolso-digital-api-prod`
(backend) e `meu-bolso-digital-tunnel` (Cloudflare Tunnel). Nenhum deles publica porta no
host - confira com `docker compose -f docker-compose.prod.yml ps` (coluna PORTS vazia).

## 5. Rodar a migração (uma vez, e de novo a cada nova migração)

```bash
docker compose -f docker-compose.prod.yml exec backend node src/database/migrate.js
```

## 6. Conferir

```bash
curl https://api.meubolso.lumvix.com.br/api/health
```

Deve responder `{"status":"ok","ambiente":"production"}`. Se der erro de DNS, aguarde 1-2
minutos (propagação) e tente de novo.

## 7. Atualizações futuras

```bash
cd meubolsodigital
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend node src/database/migrate.js
```

## Backup do banco (recomendado, faça periodicamente)

```bash
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U mbd meu_bolso_digital > backup-$(date +%Y%m%d).sql
```
