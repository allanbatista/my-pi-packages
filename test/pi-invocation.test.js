const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SCRATCH = process.env.SCRATCH || "/tmp/grok-goal-2fb4c18475e6/implementer";

function piAvailable() {
  try {
    execFileSync("which", ["pi"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function runPi(prompt) {
  const result = spawnSync(
    "pi",
    ["-e", ROOT, "-ns", "-p", prompt],
    { encoding: "utf8", timeout: 120_000 }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pi exited ${result.status}: ${result.stderr || result.stdout}`);
  }
  return (result.stdout || "").trim();
}

function saveEvidence(name, content) {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(path.join(SCRATCH, name), content + "\n");
}

const hasPi = piAvailable();

test("shipped skills contain workflow templates and guardian rubrics", () => {
  const loop = fs.readFileSync(path.join(ROOT, "skills/loop/SKILL.md"), "utf8");
  const spec = fs.readFileSync(path.join(ROOT, "skills/spec/SKILL.md"), "utf8");
  const manifest = fs.readFileSync(path.join(ROOT, "skills/manifest/SKILL.md"), "utf8");

  assert.match(loop, /## Stop Conditions/);
  assert.match(loop, /Converged/);
  assert.match(loop, /## Outcome Guardian/);
  assert.match(spec, /## Artifact Guardian/);
  assert.match(spec, /forma EARS/);
  assert.match(manifest, /## Solution Gate/);
  assert.match(manifest, /`manifest\.md` Template/);

  for (const skill of ["loop", "manifest", "spec", "ux", "arch", "plan", "execute"]) {
    const content = fs.readFileSync(path.join(ROOT, "skills", skill, "SKILL.md"), "utf8");
    assert.match(content, /## Pi Runtime/);
    assert.match(content, /PI_ADAPTATION\.md/);
  }
});

test("validate.sh writes only to stdout when SCRATCH unset", { skip: process.platform === "win32" ? "bash required" : false }, () => {
  const result = spawnSync("bash", [path.join(ROOT, "scripts/validate.sh")], {
    encoding: "utf8",
    env: { ...process.env, SCRATCH: "" },
    cwd: ROOT,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Validation complete/);
  assert.doesNotMatch(result.stdout, /grok-goal/);
});

test(
  "pi -e discovers all seven skills (run 1)",
  { skip: !hasPi ? "pi CLI not available" : false },
  () => {
    const out = runPi(
      "Reply with ONLY a comma-separated list of skill names from your available skills, sorted alphabetically"
    );
    saveEvidence("pi-load-run1.log", out);
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
    saveEvidence("pi-load-run2.log", out);
    assert.equal(out, "arch, execute, loop, manifest, plan, spec, ux");
  }
);

test(
  "/skill:loop entry returns Stop Conditions from shipped skill",
  { skip: !hasPi ? "pi CLI not available" : false },
  () => {
    const out = runPi(
      "/skill:loop From the loop skill you just loaded: reply ONLY with the three Stop Condition names in preference order, comma-separated, no other text."
    );
    saveEvidence("pi-invoke-loop.log", out);
    assert.equal(out, "Converged, Blocked, Ceiling");
  }
);

test(
  "/skill:spec guardian rubric is loadable and actionable",
  { skip: !hasPi ? "pi CLI not available" : false },
  () => {
    const out = runPi(
      "/skill:spec From the spec skill guardian rubric: reply ONLY YES or NO — does the rubric require every requirement in EARS form?"
    );
    saveEvidence("pi-invoke-spec.log", out);
    assert.equal(out, "YES");
  }
);

test(
  "/skill:manifest Solution Gate is loadable and actionable",
  { skip: !hasPi ? "pi CLI not available" : false },
  () => {
    const out = runPi(
      "/skill:manifest From the manifest skill Solution Gate fullstack case: reply ONLY with the two skills invoked (format: ux,arch)"
    );
    saveEvidence("pi-invoke-manifest.log", out);
    assert.equal(out, "ux,arch");
  }
);