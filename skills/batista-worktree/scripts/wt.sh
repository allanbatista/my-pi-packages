#!/usr/bin/env bash
set -euo pipefail

# wt.sh - Gerenciador de Git Worktrees isolados com SQLite
# Uso:
#   wt.sh init [slot]
#   wt.sh create <branch> [dir]
#   wt.sh remove [dir]
#   wt.sh status
#   wt.sh db reset
#   wt.sh db migrate

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
DEFAULT_PORT_BASE=3000

usage() {
  cat <<'EOF'
Uso do wt.sh:
  ./scripts/wt.sh init [slot]          - Cria ou atualiza .env.worktree com variáveis para SQLite isolado
  ./scripts/wt.sh create <branch> [dir] - Cria um novo git worktree e inicializa seu ambiente SQLite
  ./scripts/wt.sh remove [dir]         - Remove um git worktree e seus arquivos SQLite temporários
  ./scripts/wt.sh status               - Lista worktrees ativos, slots, branches e status do SQLite
  ./scripts/wt.sh db reset             - Remove o arquivo SQLite atual e recria o diretório temporário
  ./scripts/wt.sh db migrate           - Executa migrações locais no SQLite (via prisma/knex/typeorm/drizzle/npm run migrate)
EOF
}

# Descobre o próximo slot disponível examinando worktrees existentes
find_next_slot() {
  local used_slots=()
  while IFS= read -r wt_path; do
    if [ -f "$wt_path/.env.worktree" ]; then
      local slot
      slot=$(grep -E '^WORKTREE_SLOT=' "$wt_path/.env.worktree" 2>/dev/null | cut -d'=' -f2 || true)
      if [[ "$slot" =~ ^[0-9]+$ ]]; then
        used_slots+=("$slot")
      fi
    fi
  done < <(git worktree list --porcelain 2>/dev/null | grep '^worktree ' | cut -d' ' -f2-)

  local candidate=1
  while true; do
    local conflict=0
    for s in "${used_slots[@]}"; do
      if [ "$s" -eq "$candidate" ]; then
        conflict=1
        break
      fi
    done
    if [ "$conflict" -eq 0 ]; then
      echo "$candidate"
      return 0
    fi
    candidate=$((candidate + 1))
  done
}

cmd_init() {
  local slot="${1:-}"
  if [ -z "$slot" ]; then
    slot=$(find_next_slot)
  fi

  local cur_dir="$PWD"
  mkdir -p "$cur_dir/.tmp"

  local port_offset=$((slot * 100))
  local app_port=$((DEFAULT_PORT_BASE + port_offset))
  local db_file="$cur_dir/.tmp/dev.sqlite"
  local env_file="$cur_dir/.env.worktree"

  cat > "$env_file" <<EOF
# Gerado automaticamente por wt.sh
WORKTREE_SLOT=${slot}
PORT_OFFSET=${port_offset}
PORT=${app_port}
DB_DRIVER=sqlite
DB_FILE=${db_file}
DATABASE_URL="file:${db_file}"
SQLITE_URL="sqlite:///${db_file}"
EOF

  echo "[wt.sh] Ambiente isolado inicializado no slot ${slot}:"
  echo "  - Slot: ${slot}"
  echo "  - Porta da aplicação: ${app_port}"
  echo "  - DATABASE_URL: file:${db_file}"
  echo "  - Arquivo de configuração: ${env_file}"
}

cmd_create() {
  local branch="${1:-}"
  local target_dir="${2:-}"

  if [ -z "$branch" ]; then
    echo "Erro: Nome da branch obrigatório." >&2
    usage
    exit 1
  fi

  if [ -z "$target_dir" ]; then
    # Nome padrão baseado na branch sanitizada
    local safe_name
    safe_name=$(echo "$branch" | tr '/:' '-')
    target_dir="../worktrees/$safe_name"
  fi

  echo "[wt.sh] Criando worktree para branch '$branch' em '$target_dir'..."
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git worktree add "$target_dir" "$branch"
  else
    git worktree add -b "$branch" "$target_dir"
  fi

  local abs_target
  abs_target="$(cd "$target_dir" && pwd)"

  # Inicializa slot dentro do novo worktree
  (
    cd "$abs_target"
    local next_slot
    next_slot=$(find_next_slot)
    mkdir -p .tmp
    cat > .env.worktree <<EOF
# Gerado automaticamente por wt.sh
WORKTREE_SLOT=${next_slot}
PORT_OFFSET=$((next_slot * 100))
PORT=$((DEFAULT_PORT_BASE + next_slot * 100))
DB_DRIVER=sqlite
DB_FILE=${abs_target}/.tmp/dev.sqlite
DATABASE_URL="file:${abs_target}/.tmp/dev.sqlite"
SQLITE_URL="sqlite:///${abs_target}/.tmp/dev.sqlite"
EOF
    echo "[wt.sh] Worktree configurado em $abs_target com slot $next_slot"
  )
}

cmd_remove() {
  local target_dir="${1:-}"
  if [ -z "$target_dir" ]; then
    echo "Erro: Caminho do diretório do worktree obrigatório." >&2
    usage
    exit 1
  fi

  if [ -d "$target_dir" ]; then
    local abs_target
    abs_target="$(cd "$target_dir" 2>/dev/null && pwd || echo "$target_dir")"
    
    # Remove bancos sqlite temporários se existirem
    if [ -d "$abs_target/.tmp" ]; then
      echo "[wt.sh] Limpando arquivos temporários SQLite em $abs_target/.tmp..."
      rm -f "$abs_target/.tmp"/*.sqlite* || true
    fi

    echo "[wt.sh] Removendo git worktree $target_dir..."
    git worktree remove "$target_dir" --force || rm -rf "$target_dir"
  else
    echo "[wt.sh] Diretório não existe, podando metadados do git worktree..."
    git worktree prune
  fi
  echo "[wt.sh] Worktree removido com sucesso."
}

cmd_status() {
  echo "=== Worktrees Ativos e Status SQLite ==="
  printf "%-35s %-20s %-8s %-12s %-25s\n" "DIRETÓRIO" "BRANCH" "SLOT" "PORTA" "SQLITE STATUS"
  echo "------------------------------------------------------------------------------------------------------"

  while IFS= read -r wt_line; do
    [ -z "$wt_line" ] && continue
    local wt_dir
    wt_dir=$(echo "$wt_line" | awk '{print $1}')
    local wt_branch
    wt_branch=$(echo "$wt_line" | awk '{print $3}' | sed 's/\[//;s/\]//')

    local slot="-"
    local port="-"
    local sqlite_status="não configurado"

    if [ -f "$wt_dir/.env.worktree" ]; then
      slot=$(grep -E '^WORKTREE_SLOT=' "$wt_dir/.env.worktree" 2>/dev/null | cut -d'=' -f2 || echo "-")
      port=$(grep -E '^PORT=' "$wt_dir/.env.worktree" 2>/dev/null | cut -d'=' -f2 || echo "-")
      local db_file
      db_file=$(grep -E '^DB_FILE=' "$wt_dir/.env.worktree" 2>/dev/null | cut -d'=' -f2 || true)
      if [ -n "$db_file" ] && [ -f "$db_file" ]; then
        local sz
        sz=$(du -h "$db_file" | cut -f1)
        sqlite_status="existe ($sz)"
      else
        sqlite_status="pronto (vazio)"
      fi
    elif [ -f "$wt_dir/.tmp/dev.sqlite" ]; then
      sqlite_status="existe (.tmp/dev.sqlite)"
    fi

    printf "%-35s %-20s %-8s %-12s %-25s\n" "$(basename "$wt_dir")" "$wt_branch" "$slot" "$port" "$sqlite_status"
  done < <(git worktree list)
}

cmd_db_reset() {
  local cur_dir="$PWD"
  echo "[wt.sh] Resetando banco SQLite em $cur_dir/.tmp..."
  rm -f "$cur_dir/.tmp"/*.sqlite* 2>/dev/null || true
  mkdir -p "$cur_dir/.tmp"
  touch "$cur_dir/.tmp/dev.sqlite"
  echo "[wt.sh] Banco SQLite resetado em $cur_dir/.tmp/dev.sqlite"
}

cmd_db_migrate() {
  local cur_dir="$PWD"
  if [ -f "$cur_dir/.env.worktree" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$cur_dir/.env.worktree"
    set +a
  fi

  echo "[wt.sh] Executando migrações SQLite para ${DATABASE_URL:-file:.tmp/dev.sqlite}..."
  if [ -f "package.json" ]; then
    if grep -q '"migrate"' package.json 2>/dev/null; then
      npm run migrate
      return 0
    elif grep -q '"prisma"' package.json 2>/dev/null; then
      npx prisma migrate dev --name init || npx prisma db push
      return 0
    elif grep -q '"drizzle-kit"' package.json 2>/dev/null; then
      npx drizzle-kit push || npx drizzle-kit migrate
      return 0
    elif grep -q '"knex"' package.json 2>/dev/null; then
      npx knex migrate:latest
      return 0
    fi
  fi

  echo "[wt.sh] Nenhum orm conhecido configurado no package.json. Garantindo criação do arquivo SQLite..."
  mkdir -p "$cur_dir/.tmp"
  touch "$cur_dir/.tmp/dev.sqlite"
  echo "[wt.sh] Arquivo $cur_dir/.tmp/dev.sqlite pronto."
}

# Main dispatcher
ACTION="${1:-}"
shift || true

case "$ACTION" in
  init)
    cmd_init "$@"
    ;;
  create)
    cmd_create "$@"
    ;;
  remove|rm)
    cmd_remove "$@"
    ;;
  status)
    cmd_status "$@"
    ;;
  db)
    SUBACTION="${1:-}"
    shift || true
    case "$SUBACTION" in
      reset)
        cmd_db_reset "$@"
        ;;
      migrate)
        cmd_db_migrate "$@"
        ;;
      *)
        echo "Subcomando inválido para db: $SUBACTION" >&2
        usage
        exit 1
        ;;
    esac
    ;;
  help|-h|--help|"")
    usage
    ;;
  *)
    echo "Comando desconhecido: $ACTION" >&2
    usage
    exit 1
    ;;
esac
