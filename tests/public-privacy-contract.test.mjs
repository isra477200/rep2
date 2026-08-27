import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const EXPECTED_RECORDS = 712;

const readJson = async (relativePath) =>
  JSON.parse(await readFile(new URL(relativePath, root), "utf8"));

const publicDataNames = (
  await readdir(new URL("public/data/", root), { recursive: true })
)
  .map((name) => String(name).replaceAll("\\", "/"))
  .filter((name) => name.endsWith(".json"))
  .sort();
const publicFiles = publicDataNames.map((name) => `public/data/${name}`);
const deepRecordNames = publicDataNames
  .filter((name) => name.startsWith("deep/records/"))
  .map((name) => name.slice("deep/records/".length));
const publicIdentity = await readJson("research/deep/public-id-map.json");
const privateIds = new Set(Object.keys(publicIdentity.ids));
const dashedUuid = (value) => `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
const privateIdPattern = new RegExp([...privateIds].flatMap((id) => [id, dashedUuid(id)]).join("|"), "i");

const documentsPromise = Promise.all(
  publicFiles.map(async (file) => ({ file, value: await readJson(file) })),
);

const forbiddenKey =
  /^(?:sourceFile|password|passwd|pwd|secret|clientSecret|apiKey|api_key|accessToken|access_token|refreshToken|refresh_token|authorization|credentials?|cookie|session(?:Id|_id)?)$/i;
const notionArtifact =
  /notion\.(?:com|so|site)|<mention-(?:page|database|user)\b|(?:view|collection|notion):\/\//i;
const puenteIa = /\bpuente\s+(?:de\s+)?ia\b/i;
const localPath =
  /file:\/\/|(?:^|[\s"'(<])(?:[a-z]:[\\/](?:Users|Documents and Settings|ProgramData|Windows|tmp)[\\/]|\\\\[a-z0-9._-]+\\[a-z0-9_$.-]+(?:\\|$)|\/(?:Users|home|tmp|var\/tmp)\/)/i;
const privateNetwork =
  /\blocalhost\b|(?<![\d.])(?:(?:10|127)(?:\.\d{1,3}){3}|169\.254(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?![\d.])|(?<![\w:])::1(?![\w:])|(?<![\w:])(?:f[cd][0-9a-f]{2}|fe[89ab][0-9a-f]):[0-9a-f:]+(?![\w:])/i;
const secretValue =
  /\bBearer\s+[a-z0-9._~+/=-]{16,}|\bsk-[a-z0-9_-]{12,}\b|\b(?:ghp_|github_pat_|xox[baprs]-)[-_a-z0-9]{12,}\b|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\bAIza[0-9A-Za-z_-]{30,}\b/i;
const urlToken = /https?:\/\/[^\s<>"')\]]+/gi;
const processArtifact = /\b(?:RVC-\d+|RV-PUB-V\d+|AGREGADO-\d+|manual-wave-\d+|manual-pilot|Bandeja de registro|Origen de la migraci[oó]n|fuente de trabajo|RedVitaliaMarketResearch)\b|portal-source-snapshot|research\/deep/i;

function scan(value, file, path = "$") {
  const findings = [];
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      findings.push(...scan(child, file, `${path}[${index}]`));
    });
    return findings;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (forbiddenKey.test(key)) {
        findings.push({ category: "forbidden-key", file, path: childPath });
      }
      findings.push(...scan(child, file, childPath));
    }
    return findings;
  }
  if (typeof value !== "string") return findings;

  const checks = [
    ["notion", notionArtifact],
    ["puente-ia", puenteIa],
    ["local-path", localPath],
    ["private-network", privateNetwork],
    ["sourceFile", /\bsourceFile\b/i],
    ["credential-value", secretValue],
    ["private-page-id", privateIdPattern],
    ["internal-process", processArtifact],
  ];
  for (const [category, pattern] of checks) {
    if (pattern.test(value)) findings.push({ category, file, path });
  }

  for (const match of value.matchAll(urlToken)) {
    try {
      const url = new URL(match[0].replace(/[.,;:]+$/, ""));
      if (/(?:^|\.)validate\.perfdrive\.com$/i.test(url.hostname)) {
        findings.push({ category: "challenge-url", file, path });
      }
      if (url.username || url.password) {
        findings.push({ category: "url-credentials", file, path });
      }
      for (const key of url.searchParams.keys()) {
        if (
          /(?:^|[-_])(?:access[-_]?token|refresh[-_]?token|security[-_]?token|api[-_]?key|password|passwd|secret|client[-_]?secret|authorization|credential|signature)(?:$|[-_])/i.test(
            key,
          )
        ) {
          findings.push({ category: "credential-query", file, path });
        }
      }
    } catch {
      // Malformed public prose is validated elsewhere; it is not a privacy leak by itself.
    }
  }
  return findings;
}

test("the privacy audit covers all 712 deep records and every public JSON", () => {
  assert.equal(deepRecordNames.length, EXPECTED_RECORDS);
  for (const required of [
    "public/data/deep/index.json",
    "public/data/companies.json",
    "public/data/logos.json",
    "public/data/summary.json",
    "public/data/editorial.json",
    "public/data/audit.json",
    "public/data/portal-quality.json",
  ]) assert.ok(publicFiles.includes(required), `No se auditó ${required}`);
});

test("no public file path contains a private page ID", async () => {
  const mediaNames = await readdir(new URL("public/media/", root));
  const logoNames = await readdir(new URL("public/logos/", root));
  const paths = [...publicFiles, ...mediaNames, ...logoNames];
  const leakingPaths = paths.filter((name) => privateIdPattern.test(String(name)));
  assert.deepEqual(leakingPaths, [], `Rutas con ID privado: ${JSON.stringify(leakingPaths.slice(0, 12))}`);
});

test("no public payload exposes Notion, Puente IA, local/private infrastructure or credentials", async () => {
  const documents = await documentsPromise;
  const rawFindings = documents.flatMap(({ file, value }) => scan(value, file));
  const findings = [
    ...new Map(
      rawFindings.map((finding) => [
        `${finding.category}\0${finding.file}\0${finding.path}`,
        finding,
      ]),
    ).values(),
  ];
  const counts = findings.reduce((result, finding) => {
    result[finding.category] = (result[finding.category] || 0) + 1;
    return result;
  }, {});
  const sample = findings.slice(0, 25);

  assert.equal(
    findings.length,
    0,
    `Hallazgos privados por categoría: ${JSON.stringify(counts)}. Muestra segura (sin valores): ${JSON.stringify(sample)}`,
  );
});
