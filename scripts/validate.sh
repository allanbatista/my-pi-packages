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

EXPECTED_SKILLS=(arch execute loop manifest plan spec ux)

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
if [ "${#found[@]}" -ne 7 ]; then
  log_line "FAIL: expected 7 skills, found ${#found[@]}: ${found[*]}" structure-check
  exit 1
fi
for i in "${!sorted_expected[@]}"; do
  if [ "${sorted_expected[$i]}" != "${sorted_found[$i]}" ]; then
    log_line "FAIL: skill mismatch expected=${sorted_expected[*]} found=${sorted_found[*]}" structure-check
    exit 1
  fi
done
log_line "All 7 skills present with valid frontmatter" structure-check

log_section "skills-ref validate" skills-validate
for skill in "${EXPECTED_SKILLS[@]}"; do
  log_line "--- $skill ---" skills-validate
  (cd "$ROOT" && npx --yes skills-ref validate "./skills/$skill") 2>&1 | while IFS= read -r line; do
    log_line "$line" skills-validate
  done
done

log_section "Codex residue check" codex-residue
if rg -n '\$my-feature-workflow|\.codex-plugin|agents/openai\.yaml' "$ROOT" \
  --glob '!scripts/validate.sh' \
  --glob '!test/*' \
  --glob '!AGENTS.md' 2>/dev/null; then
  log_line "FAIL: Codex residue found" codex-residue
  exit 1
fi
log_line "No Codex residue in shipped artifacts" codex-residue

log_section "Docs evidence" docs-evidence
rg -n 'pi package|/skill:loop|pi install|pi -e' "$ROOT/AGENTS.md" "$ROOT/.memory/RULES_AND_DEFINITION.md" | while IFS= read -r line; do
  log_line "$line" docs-evidence
done

echo ""
echo "Validation complete."
if [ -n "${SCRATCH:-}" ]; then
  echo "Logs also written under $SCRATCH"
fi