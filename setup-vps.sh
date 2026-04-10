#!/bin/bash
# setup-vps.sh — executa uma vez após clonar o repo na VPS.
# Uso: bash setup-vps.sh
set -e

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       Dask — Setup VPS               ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Docker ─────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "▶ Docker não encontrado. A instalar..."
  curl -fsSL https://get.docker.com | sh
  echo "✔ Docker instalado."
else
  echo "✔ Docker já instalado: $(docker --version)"
fi

# ── 2. Ficheiro de ambiente ────────────────────────────────────────────────────
if [ ! -f .env.prod ]; then
  cp .env.prod.example .env.prod
  echo ""
  echo "⚠️  Ficheiro .env.prod criado a partir do exemplo."
  echo "   Edita os segredos antes de continuar:"
  echo ""
  echo "   nano .env.prod"
  echo ""
  echo "   Campos obrigatórios a mudar:"
  echo "     CLOUDFLARE_TUNNEL_TOKEN"
  echo "     POSTGRES_PASSWORD"
  echo "     JWT_SECRET / JWT_REFRESH_SECRET"
  echo "     HASH_PEPPER / CSRF_SECRET"
  echo ""
  exit 1
fi

echo "✔ .env.prod encontrado."

# ── 3. Build das imagens ───────────────────────────────────────────────────────
echo ""
echo "▶ A fazer build das imagens (pode demorar na primeira vez)..."
$COMPOSE build

# ── 4. Iniciar infra (postgres + redis) e aguardar health ─────────────────────
echo ""
echo "▶ A iniciar postgres e redis..."
$COMPOSE up -d postgres redis

echo "   Aguardar postgres ficar saudável..."
until [ "$(docker inspect --format='{{.State.Health.Status}}' dask-postgres 2>/dev/null)" = "healthy" ]; do
  echo -n "."
  sleep 2
done
echo ""
echo "✔ Postgres pronto."

# ── 5. Schema da base de dados ────────────────────────────────────────────────
echo ""
echo "▶ A aplicar schema Prisma (prisma db push)..."
$COMPOSE run --rm api npx prisma db push
echo "✔ Schema aplicado."

# ── 6. Subir todos os serviços ────────────────────────────────────────────────
echo ""
echo "▶ A subir todos os serviços..."
$COMPOSE up -d

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅  Dask está online!                                   ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Ver estado:  docker compose -f docker-compose.prod.yml ps     ║"
echo "║  Ver logs:    docker compose -f docker-compose.prod.yml logs -f ║"
echo "║  Parar tudo:  docker compose -f docker-compose.prod.yml down    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
