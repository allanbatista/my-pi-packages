#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRATCH="${SCRATCH:-/tmp/grok-goal-2fb4c18475e6/implementer}"
mkdir -p "$SCRATCH"

EXPECTED_SKILLS=(arch execute loop manifest plan spec ux)
STRUCTURE_LOG="$SCRATCH/structure-check.log"
VALIDATE_LOG="$SCRATCH/skills-validate.log"
RESIDUE_LOG="$SCRATCH/codex-residue.log"
DOCS_LOG="$SCRATCH/docs-evidence.log"

: >"$STRUCTURE_LOG"
: >"$VALIDATE_LOG"
: >"$RESIDUE_LOG"
: >"$DOCS_LOG"

echo "=== Structure check ===" | tee -a "$STRUCTURE_LOG"
node -e "
const fs = require('fs');
const path = require('path');
const pkg = JSON.parse(fs.readFileSync('$ROOT/package.json', 'utf8'));
if (!pkg.keywords?.includes('pi-package')) throw new Error('missing pi-package keyword');
if (!pkg.pi?.skills?.length) throw new Error('missing pi.skills manifest');
console.log('package.json OK:', pkg.name, pkg.version);
" | tee -a "$STRUCTURE_LOG"

SKILLS_DIR="$ROOT/skills"
found=()
for dir in "$SKILLS_DIR"/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  found+=("$name")
  skill_file="$dir/SKILL.md"
  if [ ! -f "$skill_file" ]; then
    echo "FAIL: missing SKILL.md in $name" | tee -a "$STRUCTURE_LOG"
    exit 1
  fi
  if ! grep -q '^name:' "$skill_file" || ! grep -q '^description:' "$skill_file"; then
    echo "FAIL: frontmatter missing name/description in $name" | tee -a "$STRUCTURE_LOG"
    exit 1
  fi
  echo "OK: $name" | tee -a "$STRUCTURE_LOG"
done

IFS=$'\n' sorted_found=($(printf '%s\n' "${found[@]}" | sort))
IFS=$'\n' sorted_expected=($(printf '%s\n' "${EXPECTED_SKILLS[@]}" | sort))
if [ "${#found[@]}" -ne 7 ]; then
  echo "FAIL: expected 7 skills, found ${#found[@]}: ${found[*]}" | tee -a "$STRUCTURE_LOG"
  exit 1
fi
for i in "${!sorted_expected[@]}"; do
  if [ "${sorted_expected[$i]}" != "${sorted_found[$i]}" ]; then
    echo "FAIL: skill mismatch expected=${sorted_expected[*]} found=${sorted_found[*]}" | tee -a "$STRUCTURE_LOG"
    exit 1
  fi
done
echo "All 7 skills present with valid frontmatter" | tee -a "$STRUCTURE_LOG"

echo "" | tee -a "$VALIDATE_LOG"
echo "=== skills-ref validate ===" | tee -a "$VALIDATE_LOG"
for skill in "${EXPECTED_SKILLS[@]}"; do
  echo "--- $skill ---" | tee -a "$VALIDATE_LOG"
  (cd "$ROOT" && npx --yes skills-ref validate "./skills/$skill") 2>&1 | tee -a "$VALIDATE_LOG"
done

echo "" | tee -a "$RESIDUE_LOG"
echo "=== Codex residue check ===" | tee -a "$RESIDUE_LOG"
if rg -n '\$my-feature-workflow|\.codex-plugin|agents/openai\.yaml' "$ROOT" \
  --glob '!scripts/validate.sh' \
  --glob '!test/*' \
  --glob '!AGENTS.md' 2>/dev/null; then
  echo "FAIL: Codex residue found" | tee -a "$RESIDUE_LOG"
  exit 1
fi
echo "No Codex residue in shipped artifacts" | tee -a "$RESIDUE_LOG"

echo "" | tee -a "$DOCS_LOG"
echo "=== Docs evidence ===" | tee -a "$DOCS_LOG"
rg -n 'pi package|/skill:loop|pi install|pi -e' "$ROOT/AGENTS.md" "$ROOT/.memory/RULES_AND_DEFINITION.md" | tee -a "$DOCS_LOG"

echo ""
echo "Validation complete. Logs in $SCRATCH"