const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SCRATCH = process.env.SCRATCH;

function piAvailable() {
  try {
    execFileSync("which", ["pi"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function runPi(prompt) {
  const result = spawnSync("pi", ["-e", ROOT, "-ns", "-p", prompt], {
    encoding: "utf8",
    timeout: 180_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pi exited ${result.status}: ${result.stderr || result.stdout}`);
  }
  return (result.stdout || "").trim();
}

function maybeSaveEvidence(name, content) {
  if (!SCRATCH) return;
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(path.join(SCRATCH, name), content + "\n");
}

function createSandbox() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "pi-workflow-"));
  fs.writeFileSync(
    path.join(sandbox, "AGENTS.md"),
    "# Sandbox project for pi workflow integration tests\n"
  );
  return sandbox;
}

const hasPi = piAvailable();

test("skills encode Pi-first delegation in Workflow sections", () => {
  for (const skill of ["loop", "manifest", "spec", "execute"]) {
    const content = fs.readFileSync(path.join(ROOT, "skills", skill, "SKILL.md"), "utf8");
    assert.match(content, /## Delegação/);
    assert.match(content, /inline por padrão no Pi|inline ou subagent|Padrão Pi/i);
    assert.doesNotMatch(content, /gpt-5\.[45]/);
  }
});

test(
  "pi -e discovers all seven skills (run 1)",
  { skip: !hasPi ? "pi CLI not available" : false },
  () => {
    const out = runPi(
      "Reply with ONLY a comma-separated list of skill names from your available skills, sorted alphabetically"
    );
    maybeSaveEvidence("pi-load-run1.log", out);
    assert.equal(out, "arch, execute, loop, manifest, plan, spec, ux");
  }
);

test(
  "pi -e discovers all seven skills (run 2)",
  { skip: !hasPi ? "pi CLI not available" : false },
  () => {
    const out = runPi(
      "Reply with ONLY a comma-separated list of skill names from your available skills, sorted alphabetically"
    );
    maybeSaveEvidence("pi-load-run2.log", out);
    assert.equal(out, "arch, execute, loop, manifest, plan, spec, ux");
  }
);

test(
  "/skill:spec writes spec.md with Discovery Ledger and EARS requirement",
  { skip: !hasPi ? "pi CLI not available" : false },
  () => {
    const sandbox = createSandbox();
    const featureDir = path.join(sandbox, ".features", "2099-01-01_0000-pi-port-validation");
    const specPath = path.join(featureDir, "spec.md");

    const prompt = [
      `Project root: ${sandbox}`,
      "/skill:spec",
      `Create ${specPath} following the spec skill workflow and template.`,
      "Required: Status: draft; ## Objective; ## Discovery Ledger table with D1 row;",
      "## Intent Classification; ## Requirements Traceability with one EARS requirement.",
      "Do not mark ready; skip guardian for this test.",
      "Write the file to disk now.",
      "Reply with exactly: WROTE:" + specPath,
    ].join(" ");

    const out = runPi(prompt);
    maybeSaveEvidence(
      "pi-spec-artifact.log",
      [out, "---", fs.existsSync(specPath) ? fs.readFileSync(specPath, "utf8") : "MISSING"].join("\n")
    );

    assert.match(out, new RegExp(`WROTE:${specPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.ok(fs.existsSync(specPath), "spec.md was not created");

    const spec = fs.readFileSync(specPath, "utf8");
    assert.match(spec, /Status:\s*draft/);
    assert.match(spec, /## Discovery Ledger/);
    assert.match(spec, /\| D1 \|/);
    assert.match(spec, /## Requirements Traceability/);
    assert.match(spec, /Quando .+ o sistema deve/i);
  }
);

test(
  "/skill:loop writes loop.md with objective and convergence fields",
  { skip: !hasPi ? "pi CLI not available" : false },
  () => {
    const sandbox = createSandbox();
    const loopPath = path.join(sandbox, ".features", "2099-01-01_0001-loop-validation", "loop.md");

    const prompt = [
      `Project root: ${sandbox}`,
      "/skill:loop",
      `Create ${loopPath} using the loop skill template.`,
      "Required: Status: running; Iteration budget: 5; Iterations used: 0;",
      "## Objective with Resultado esperado and Evidência de aceite;",
      "## Convergence Ledger with one entry; ## Resume Point.",
      "Write the file to disk now.",
      "Reply with exactly: WROTE:" + loopPath,
    ].join(" ");

    const out = runPi(prompt);
    maybeSaveEvidence(
      "pi-loop-artifact.log",
      [out, "---", fs.existsSync(loopPath) ? fs.readFileSync(loopPath, "utf8") : "MISSING"].join("\n")
    );

    assert.match(out, new RegExp(`WROTE:${loopPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.ok(fs.existsSync(loopPath), "loop.md was not created");

    const loop = fs.readFileSync(loopPath, "utf8");
    assert.match(loop, /Status:\s*running/);
    assert.match(loop, /Iteration budget:\s*5/);
    assert.match(loop, /## Objective/);
    assert.match(loop, /## Convergence Ledger/);
    assert.match(loop, /## Resume Point/);
  }
);