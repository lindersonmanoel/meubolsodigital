#!/usr/bin/env bash
# Instala e sobe o backend do Meu Bolso Digital (API + Postgres) numa VM Ubuntu.
# Uso (na VM):
#   curl -fsSL https://raw.githubusercontent.com/lindersonmanoel/meubolsodigital/main/scripts/setup-vm.sh | bash
# Opcional: RESEND_API_KEY=re_xxx antes do "bash" pra ja deixar o envio de e-mail configurado.
# Pode rodar de novo a qualquer momento: atualiza o codigo e reaplica, sem apagar o banco
# nem trocar as senhas ja geradas.
set -euo pipefail

REPO="https://github.com/lindersonmanoel/meubolsodigital.git"
DIR="$HOME/meubolsodigital"

echo "==> Instalando Docker, git e utilitarios"
sudo apt-get update -y
sudo apt-get install -y docker.io git openssl curl
sudo apt-get install -y docker-compose-v2 || sudo apt-get install -y docker-compose-plugin || true
sudo systemctl enable --now docker
sudo docker compose version >/dev/null

echo "==> Baixando o projeto em $DIR"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone "$REPO" "$DIR"
fi
cd "$DIR"

if [ ! -f .env.production ]; then
  echo "==> Gerando .env.production com senhas novas (ficam so nesta VM)"
  PG="$(openssl rand -hex 16)"
  JWT="$(openssl rand -hex 48)"
  cat > .env.production <<EOF
NODE_ENV=production
PORT=3000
POSTGRES_PASSWORD=$PG
DATABASE_URL=postgresql://mbd:$PG@postgres:5432/meu_bolso_digital
DATABASE_SSL=false
JWT_SECRET=$JWT
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://meu-bolso-digital-web.vercel.app
RESEND_API_KEY=${RESEND_API_KEY:-}
EMAIL_FROM="Meu Bolso Digital <onboarding@resend.dev>"
EOF
  chmod 600 .env.production
else
  echo "==> .env.production ja existe, mantido como esta"
fi

echo "==> Subindo Postgres + API (as migracoes rodam sozinhas)"
sudo docker compose --env-file .env.production -f docker-compose.vm.yml up -d --build

echo "==> Aguardando a API responder"
for i in $(seq 1 60); do
  if curl -fs http://localhost:3000/api/health; then
    echo
    echo "OK: backend no ar em http://localhost:3000 (nesta VM)."
    echo "Proximo passo: expor com HTTPS (ngrok) e apontar o site pra esse endereco."
    exit 0
  fi
  sleep 3
done

echo "A API nao respondeu a tempo. Veja o log: sudo docker compose --env-file .env.production -f docker-compose.vm.yml logs backend"
exit 1
