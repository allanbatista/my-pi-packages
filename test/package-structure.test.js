const fs = require("fs");
const path = require("path");
const { test } = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const EXPECTED = ["arch", "execute", "loop", "manifest", "plan", "spec", "ux"];

function readFrontmatter(skillPath) {
  const content = fs.readFileSync(skillPath, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, `missing frontmatter: ${skillPath}`);
  const name = match[1].match(/^name:\s*(.+)$/m);
  const description = match[1].match(/^description:\s*(.+)$/m);
  assert.ok(name?.[1]?.trim(), `missing name: ${skillPath}`);
  assert.ok(description?.[1]?.trim(), `missing description: ${skillPath}`);
  return { name: name[1].trim(), description: description[1].trim() };
}

test("package.json is a valid pi package", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.ok(pkg.keywords.includes("pi-package"));
  assert.deepEqual(pkg.pi.skills, ["./skills"]);
});

test("all seven skills exist with valid frontmatter", () => {
  const skillsDir = path.join(ROOT, "skills");
  const dirs = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  assert.deepEqual(dirs, [...EXPECTED].sort());
  for (const skill of EXPECTED) {
    const skillPath = path.join(skillsDir, skill, "SKILL.md");
    assert.ok(fs.existsSync(skillPath));
    const fm = readFrontmatter(skillPath);
    assert.equal(fm.name, skill);
    assert.ok(fm.description.length > 0);
  }
});

test("skills use Pi invocation syntax not Codex", () => {
  for (const skill of EXPECTED) {
    const content = fs.readFileSync(path.join(ROOT, "skills", skill, "SKILL.md"), "utf8");
    assert.doesNotMatch(content, /\$my-feature-workflow/);
    if (skill === "loop") {
      assert.match(content, /\/skill:loop/);
      assert.match(content, /\/skill:manifest/);
      assert.match(content, /\/skill:execute/);
    }
  }
});

test("no Codex-only artifacts shipped", () => {
  const walk = (dir, acc = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        walk(full, acc);
      } else {
        acc.push(full);
      }
    }
    return acc;
  };
  const files = walk(ROOT).filter(
    (f) => !f.includes(`${path.sep}test${path.sep}`) && !f.endsWith("validate.sh")
  );
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    assert.doesNotMatch(rel, /\.codex-plugin/);
    assert.doesNotMatch(rel, /agents\/openai\.yaml/);
    if (rel.endsWith(".md") || rel.endsWith(".json") || rel.endsWith(".js")) {
      const content = fs.readFileSync(file, "utf8");
      if (rel !== "AGENTS.md") {
        assert.doesNotMatch(content, /\$my-feature-workflow/);
      }
    }
  }
});

test("AGENTS.md and RULES describe Pi package", () => {
  const agents = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
  const rules = fs.readFileSync(path.join(ROOT, ".memory", "RULES_AND_DEFINITION.md"), "utf8");
  assert.match(agents, /pi package/i);
  assert.match(agents, /\/skill:loop/);
  assert.match(rules, /\/skill:loop/);
  assert.doesNotMatch(rules, /\.codex-plugin/);
});