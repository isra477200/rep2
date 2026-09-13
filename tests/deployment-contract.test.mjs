import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const dockerignore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");
const workflow = readFileSync(
  new URL("../.github/workflows/publish-container.yml", import.meta.url),
  "utf8",
);

test("the runtime image does not duplicate the application through recursive chown", () => {
  assert.doesNotMatch(dockerfile, /chown\s+-R\s+node:node\s+\/app/);
  assert.match(
    dockerfile,
    /COPY --from=build --chown=node:node \/app\/node_modules \.\/node_modules/,
  );
  assert.match(
    dockerfile,
    /COPY --from=build --chown=node:node \/app\/dist \.\/dist/,
  );
});

test("the image exposes an immutable commit marker", () => {
  assert.match(dockerfile, /ARG GIT_SHA=development/);
  assert.match(dockerfile, /dist\/client\/deployment\.txt/);
  assert.match(workflow, /GIT_SHA=\$\{\{ github\.sha \}\}/);
});

test("the Docker context excludes local secrets and generated work", () => {
  assert.match(dockerignore, /^\.env\*$/m);
  assert.match(dockerignore, /^\.vinext$/m);
  assert.match(dockerignore, /^tsconfig\.tsbuildinfo$/m);
  assert.match(dockerignore, /^outputs$/m);
});

test("production deploys are serialized and verified to completion", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /group: redvitalia-production/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /timeout-minutes: 75/);
  assert.match(workflow, /run: npm run deployment:qa/);
  assert.match(workflow, /org\.opencontainers\.image\.revision=\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /\.id \| numbers/);
  assert.match(workflow, /\.state \| strings/);
  assert.match(
    workflow,
    /virtual-machines\/1480016\/actions\/\$\{action_id\}/,
  );
  assert.match(workflow, /408\|425\|429\|500\|502\|503\|504/);
  assert.match(workflow, /deployment\.txt\?expected=\$\{EXPECTED_SHA\}/);
  assert.match(workflow, /Production is serving the expected commit/);
});

test("missing deployment credentials never report a verified release", () => {
  const missingKey = workflow.match(/if \[ -z "\$\{HOSTINGER_API_KEY:-\}" \]; then([\s\S]*?)\n\s*fi/);
  assert.ok(missingKey, "missing-key handling must remain explicit");
  assert.match(missingKey[1], /GITHUB_STEP_SUMMARY/);
  assert.match(missingKey[1], /exit 1/);
  assert.doesNotMatch(missingKey[1], /exit 0/);
});

test("Hostinger started actions keep polling, while errors still stop the deployment", () => {
  const actionCase = workflow.match(/case "\$action_state" in[\s\S]*?\n\s*esac/);
  assert.ok(actionCase, "the real deployment status handler must be present");
  const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
  const script = `action_id=fixture
for action_state in "$@"; do
${actionCase[0]}
printf 'WAIT_FOR_ACTION\\n'
done`;
  const run = (...states) => spawnSync(bash, ["--noprofile", "--norc", "-c", script, "status-test", ...states], { encoding: "utf8" });

  const completed = run("created", "sent", "delayed", "started", "success");
  assert.equal(completed.status, 0, completed.stderr || completed.stdout);
  assert.equal((completed.stdout.match(/WAIT_FOR_ACTION/g) || []).length, 4);
  assert.match(completed.stdout, /completed successfully/);

  for (const failedState of ["error", "unexpected-status"]) {
    const failed = run(failedState);
    assert.equal(failed.status, 1, failed.stderr || failed.stdout);
    assert.doesNotMatch(failed.stdout, /WAIT_FOR_ACTION|completed successfully/);
  }
});
