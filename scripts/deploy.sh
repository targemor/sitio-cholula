#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Build + deploy de visitcholula.mx a S3 + CloudFront
# =============================================================================
#
# SYNOPSIS
#   Build + deploy de visitcholula.mx a S3 + CloudFront con headers de cache correctos.
#
# DESCRIPTION
#   Sube el sitio estatico de Astro a S3 aplicando Cache-Control por tipo de archivo:
#     - Assets con hash (_astro/*) e imagenes/video  -> public, max-age=31536000, immutable
#     - HTML (nombres estables)                       -> public, max-age=0, must-revalidate
#   Luego invalida CloudFront.
#
#   IMPORTANTE sobre 'aws s3 sync':
#   'sync' solo escribe el metadato --cache-control en los archivos que realmente sube;
#   omite los que considera sin cambios y NO les actualiza los metadatos. Por eso, la
#   PRIMERA vez (o si algun objeto quedo sin header) debes correr con --force, que resube
#   todo desde ./dist y sella el Cache-Control en cada objeto. Una vez sellados, los
#   deploys normales con 'sync' conservan ese metadato en los archivos omitidos.
#
# PARAMETROS
#   --bucket          Nombre del bucket S3         (default: visit-cholula)
#   --distribution-id ID de distribucion CloudFront (default: EXCHH9HZ359RZ)
#   --dist-dir        Carpeta de salida del build   (default: dist)
#   --site-url        URL publica del sitio          (default: https://visitcholula.mx)
#   --force           Resube TODOS los archivos para garantizar Cache-Control
#   --skip-build      Omite 'pnpm run build'
#   --skip-invalidation No crea la invalidacion de CloudFront
#
# EJEMPLOS
#   # Primer deploy / reparar headers de cache:
#   ./scripts/deploy.sh --force
#
#   # Deploy normal (rapido):
#   ./scripts/deploy.sh
#
# =============================================================================

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
BUCKET="visit-cholula"
DISTRIBUTION_ID="EXCHH9HZ359RZ"
DIST_DIR="dist"
SITE_URL="https://visitcholula.mx"
FORCE=false
SKIP_BUILD=false
SKIP_INVALIDATION=false

IMMUTABLE="public, max-age=31536000, immutable"
REVALIDATE="public, max-age=0, must-revalidate"

# Evita error 'stream is not seekable' en AWS CLI (botocore) al subir archivos estaticos
export AWS_REQUEST_CHECKSUM_CALCULATION="WHEN_REQUIRED"

# ── Colores / helpers ─────────────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'

step()  { echo -e "\n${CYAN}==> $*${RESET}"; }
ok()    { echo -e "    ${GREEN}$*${RESET}"; }
warn()  { echo -e "    ${YELLOW}$*${RESET}"; }
die()   { echo -e "${RED}ERROR: $*${RESET}" >&2; exit 1; }

# ── Parseo de argumentos ──────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bucket)           BUCKET="$2";          shift 2 ;;
    --distribution-id)  DISTRIBUTION_ID="$2"; shift 2 ;;
    --dist-dir)         DIST_DIR="$2";        shift 2 ;;
    --site-url)         SITE_URL="$2";        shift 2 ;;
    --force)            FORCE=true;           shift   ;;
    --skip-build)       SKIP_BUILD=true;      shift   ;;
    --skip-invalidation) SKIP_INVALIDATION=true; shift ;;
    -h|--help)
      sed -n '/^# SYNOPSIS/,/^# ====/p' "$0" | grep -v '^# ====' | sed 's/^# \?//'
      exit 0
      ;;
    *) die "Argumento desconocido: $1" ;;
  esac
done

# ── Rutas: ejecutar siempre desde la raiz del proyecto (padre de /scripts) ────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"
DIST_PATH="$PROJECT_ROOT/$DIST_DIR"

S3="s3://$BUCKET/"

# ── Verificaciones previas ────────────────────────────────────────────────────
step "Verificando herramientas"
command -v aws  &>/dev/null || die "AWS CLI no encontrado en PATH."
if [[ "$SKIP_BUILD" == false ]]; then
  command -v pnpm &>/dev/null || die "pnpm no encontrado en PATH."
fi
ok "aws: $(command -v aws)"

# ── Build ─────────────────────────────────────────────────────────────────────
if [[ "$SKIP_BUILD" == true ]]; then
  step "Build omitido (--skip-build)"
else
  step "Build (pnpm run build)"
  pnpm run build
  ok "Build completado"
fi

[[ -d "$DIST_PATH" ]] || die "No existe la carpeta de salida: $DIST_PATH"

# ── Subida ────────────────────────────────────────────────────────────────────
if [[ "$FORCE" == true ]]; then
  step "Modo --force: podando borrados y resubiendo TODO con headers de cache"

  # 1) Poda objetos que ya no existen en ./dist (sync --delete tambien sube cambios).
  aws s3 sync "$DIST_PATH" "$S3" --delete

  # 2) Reseca todos los assets (todo menos HTML) como inmutables.
  aws s3 cp "$DIST_PATH" "$S3" --recursive \
      --exclude "*.html" \
      --cache-control "$IMMUTABLE"

  # 3) Reseca el HTML para que revalide.
  aws s3 cp "$DIST_PATH" "$S3" --recursive \
      --exclude "*" --include "*.html" \
      --cache-control "$REVALIDATE"

  ok "Todos los objetos sellados con Cache-Control"
else
  step "Deploy normal (sync en dos pasadas)"

  # 1) Assets inmutables + poda de borrados.
  aws s3 sync "$DIST_PATH" "$S3" --delete \
      --exclude "*.html" \
      --cache-control "$IMMUTABLE"

  # 2) HTML con revalidacion.
  aws s3 sync "$DIST_PATH" "$S3" \
      --exclude "*" --include "*.html" \
      --cache-control "$REVALIDATE"

  ok "Sync completado"
fi

# ── Invalidacion CloudFront ────────────────────────────────────────────────────
if [[ "$SKIP_INVALIDATION" == true ]]; then
  step "Invalidacion omitida (--skip-invalidation)"
else
  step "Invalidando CloudFront ($DISTRIBUTION_ID)"
  # "/*" cuenta como UNA sola ruta de invalidacion. Con assets inmutables de nombre
  # unico, en realidad solo el HTML necesita invalidarse, pero "/*" es simple y barato.
  OUT=$(aws cloudfront create-invalidation \
        --distribution-id "$DISTRIBUTION_ID" \
        --paths "/*" \
        --output json)

  INV_ID=$(echo "$OUT"     | grep -o '"Id": "[^"]*"'     | head -1 | cut -d'"' -f4 || true)
  INV_STATUS=$(echo "$OUT" | grep -o '"Status": "[^"]*"' | head -1 | cut -d'"' -f4 || true)

  if [[ -n "$INV_ID" ]]; then
    ok "Invalidacion creada: $INV_ID  estado: $INV_STATUS"
  else
    ok "Invalidacion creada."
  fi
fi

# ── Verificacion de headers ───────────────────────────────────────────────────
step "Verificando Cache-Control servido por CloudFront"

get_cache_control() {
  local url="$1"
  curl -sI --max-time 20 "$url" \
    | grep -i '^cache-control:' \
    | sed 's/^[Cc]ache-[Cc]ontrol:[[:space:]]*//' \
    | tr -d '\r' \
    || echo "(error o sin header)"
}

# Un asset con hash real (tomado del build) y el HTML raiz.
FIRST_ASSET=$(find "$DIST_PATH/_astro" -name "*.js" 2>/dev/null | head -1 || true)
if [[ -n "$FIRST_ASSET" ]]; then
  ASSET_NAME="$(basename "$FIRST_ASSET")"
  ASSET_URL="$SITE_URL/_astro/$ASSET_NAME"
  CC_ASSET=$(get_cache_control "$ASSET_URL")
  if [[ "$CC_ASSET" == *"immutable"* ]]; then
    ok "asset  OK  -> $CC_ASSET"
  else
    warn "asset  revisar -> '$CC_ASSET'  ($ASSET_URL)"
  fi
fi

CC_HTML=$(get_cache_control "$SITE_URL/")
if [[ "$CC_HTML" == *"must-revalidate"* ]]; then
  ok "html   OK  -> $CC_HTML"
else
  warn "html   revisar -> '$CC_HTML'  (la invalidacion puede tardar unos minutos en propagar)"
fi

echo -e "\n${CYAN}Deploy finalizado.${RESET}"