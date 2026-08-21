#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

log_section() {
  local label="$1"
  shift
  echo ""
  echo "=== $label ==="
  if [ -n "${SCRATCH:-}" ]; then
    mkdir -p "$SCRATCH"
    echo "=== $label ===" >>"$SCRATCH/${2:-validate}.log"
  fi
}

log_line() {
  echo "$1"
  if [ -n "${SCRATCH:-}" ]; then
    echo "$1" >>"$SCRATCH/${2:-validate}.log"
  fi
}

EXPECTED_SKILLS=(batista-arch batista-execute batista-incident batista-loop batista-manager-orchestrator batista-manifest batista-plan batista-spec batista-ux batista-validation batista-discord-webhook-messages batista-memory batista-ship-pr-to-deploy batista-websearch batista-worktree)

log_section "Structure check" structure-check
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$ROOT/package.json', 'utf8'));
if (!pkg.keywords?.includes('pi-package')) throw new Error('missing pi-package keyword');
if (!pkg.pi?.skills?.length) throw new Error('missing pi.skills manifest');
console.log('package.json OK:', pkg.name, pkg.version);
" | while IFS= read -r line; do log_line "$line" structure-check; done

SKILLS_DIR="$ROOT/skills"
found=()
for dir in "$SKILLS_DIR"/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  found+=("$name")
  skill_file="$dir/SKILL.md"
  if [ ! -f "$skill_file" ]; then
    log_line "FAIL: missing SKILL.md in $name" structure-check
    exit 1
  fi
  if ! grep -q '^name:' "$skill_file" || ! grep -q '^description:' "$skill_file"; then
    log_line "FAIL: frontmatter missing name/description in $name" structure-check
    exit 1
  fi
  log_line "OK: $name" structure-check
done

IFS=$'\n' sorted_found=($(printf '%s\n' "${found[@]}" | sort))
IFS=$'\n' sorted_expected=($(printf '%s\n' "${EXPECTED_SKILLS[@]}" | sort))
if [ "${#found[@]}" -ne 15 ]; then
  log_line "FAIL: expected 15 skills, found ${#found[@]}: ${found[*]}" structure-check
  exit 1
fi
for i in "${!sorted_expected[@]}"; do
  if [ "${sorted_expected[$i]}" != "${sorted_found[$i]}" ]; then
    log_line "FAIL: skill mismatch expected=${sorted_expected[*]} found=${sorted_found[*]}" structure-check
    exit 1
  fi
done
log_line "All 15 skills present with valid frontmatter" structure-check

log_section "skills-ref validate" skills-validate
for skill in "${EXPECTED_SKILLS[@]}"; do
  log_line "--- $skill ---" skills-validate
  (cd "$ROOT" && npx --yes skills-ref validate "./skills/$skill") 2>&1 | while IFS= read -r line; do
    log_line "$line" skills-validate
  done
done

log_section "Agents drift check (package vs installed)" agents-drift
# Politica: nenhum papel pina model/thinking (o modelo indicado pelo usuario prevalece).
# O frontmatter dos agent files do package e a fonte da verdade: divergencia com o
# instalado (global ou projeto) e deriva — inclusive pin reintroduzido no instalado
# (correcao manual ou reinstalacao parcial que ressuscita pins antigos).
field() { awk -v k="$1" -v f="$2" '$0 ~ "^" k ":" { sub(/^[^:]+:[[:space:]]*/, ""); print }' "$2"; }
for af in "$ROOT"/agents/*.md; do
  name="$(basename "$af")"
  if [ -n "$(field model "$af")" ] || [ -n "$(field thinking "$af")" ]; then
    log_line "FAIL: $name declara model/thinking no frontmatter (politica: sem pin; usuario prevalece)" agents-drift
    exit 1
  fi
  src_fields="|$(field model "$af")|$(field thinking "$af")|$(field extensions "$af")|$(field tools "$af")|"
  checked=0
  for inst in "$HOME/.pi/agent/agents/$name" "$ROOT/.pi/agents/$name"; do
    [ -f "$inst" ] || continue
    checked=1
    inst_fields="|$(field model "$inst")|$(field thinking "$inst")|$(field extensions "$inst")|$(field tools "$inst")|"
    if [ "$src_fields" != "$inst_fields" ]; then
      log_line "FAIL: $name diverge do package:" agents-drift
      log_line "  package : $src_fields" agents-drift
      log_line "  instalado: $inst_fields ($inst)" agents-drift
      exit 1
    fi
    log_line "OK: $name == $inst" agents-drift
  done
  if [ "$checked" -eq 0 ]; then
    log_line "WARN: $name nao instalado (sem $HOME/.pi/agent/agents/$name nem .pi/agents/$name)" agents-drift
  fi
done
log_line "No agent drift (model/thinking ausentes nos agent files)" agents-drift

log_section "Codex residue check" codex-residue
if command -v rg >/dev/null 2>&1; then
  if rg -n '\$my-feature-workflow|\.codex-plugin|agents/openai\.yaml' "$ROOT" \
    --glob '!scripts/validate.sh' \
    --glob '!test/*' \
    --glob '!AGENTS.md' 2>/dev/null; then
    log_line "FAIL: Codex residue found" codex-residue
    exit 1
  fi
else
  if grep -r -E '\$my-feature-workflow|\.codex-plugin|agents/openai\.yaml' "$ROOT" \
    --exclude='validate.sh' \
    --exclude-dir='test' \
    --exclude='AGENTS.md' \
    --exclude-dir='.git' \
    --exclude-dir='node_modules' 2>/dev/null; then
    log_line "FAIL: Codex residue found" codex-residue
    exit 1
  fi
fi
log_line "No Codex residue in shipped artifacts" codex-residue

log_section "Docs evidence" docs-evidence
if command -v rg >/dev/null 2>&1; then
  rg -n 'pi package|/skill:batista-loop|pi install|pi -e' "$ROOT/AGENTS.md" "$ROOT/.memory/RULES_AND_DEFINITION.md" | while IFS= read -r line; do
    log_line "$line" docs-evidence
  done
else
  grep -n -E 'pi package|/skill:batista-loop|pi install|pi -e' "$ROOT/AGENTS.md" "$ROOT/.memory/RULES_AND_DEFINITION.md" | while IFS= read -r line; do
    log_line "$line" docs-evidence
  done
fi

echo ""
echo "Validation complete."
if [ -n "${SCRATCH:-}" ]; then
  echo "Logs also written under $SCRATCH"
fi
