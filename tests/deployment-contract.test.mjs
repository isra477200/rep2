import assert from "node:assert/strict";
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
