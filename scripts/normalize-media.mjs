import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mediaDir = path.join(root, "public", "media");
const quarantineDir = path.join(root, "audit", "media-invalid");
const dataDir = path.join(root, "public", "data");

const mimeByKind = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

function detectKind(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return "jpg";
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  )
    return "png";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF")
    return "pdf";
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "GIF8")
    return "gif";
  const text = buffer.toString("utf8").trimStart();
  if (
    text.startsWith("<svg") ||
    (text.startsWith("<?xml") && text.includes("<svg"))
  )
    return "svg";
  return "unknown";
}

function invalidSvgReason(buffer) {
  const text = buffer.toString("utf8");
  if (!text.includes("</svg>")) return "SVG incompleto";
  if (text.includes("Identifier 'sh' has already been declared"))
    return "captura técnica fallida; no contiene una creatividad";
  for (const match of text.matchAll(
    /(?:href|xlink:href)=["'](data:[^"']+)["']/g,
  )) {
    const uri = match[1];
    if (!uri.includes(";base64,")) continue;
    const payload = uri.slice(uri.indexOf(";base64,") + 8).replace(/\s/g, "");
    if (
      !/^[A-Za-z0-9+/]*={0,2}$/.test(payload) ||
      Buffer.from(payload, "base64").length < 8
    ) {
      return "recurso incrustado inválido";
    }
  }
  return "";
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

await mkdir(quarantineDir, { recursive: true });
const names = await readdir(mediaDir);
const pathMap = new Map();
const invalid = new Map();
const correctionCounts = {};

for (const name of names) {
  const oldPath = path.join(mediaDir, name);
  const buffer = await readFile(oldPath);
  const kind = detectKind(buffer);
  if (!(kind in mimeByKind)) throw new Error(`Formato no reconocido: ${name}`);
  const currentExt = path.extname(name).slice(1).toLowerCase();
  const invalidReason = kind === "svg" ? invalidSvgReason(buffer) : "";

  if (invalidReason) {
    const target = path.join(
      quarantineDir,
      name.replace(/\.[^.]+$/, `.${kind}`),
    );
    if (!(await exists(target))) await rename(oldPath, target);
    invalid.set(`/media/${name}`, {
      file: name,
      quarantinedAs: path.relative(root, target).replaceAll("\\", "/"),
      reason: invalidReason,
      bytes: buffer.length,
    });
    continue;
  }

  if (currentExt !== kind) {
    const newName = name.replace(/\.[^.]+$/, `.${kind}`);
    const newPath = path.join(mediaDir, newName);
    if (await exists(newPath))
      throw new Error(`Colisión al renombrar ${name} → ${newName}`);
    await rename(oldPath, newPath);
    pathMap.set(`/media/${name}`, `/media/${newName}`);
    const key = `${currentExt}→${kind}`;
    correctionCounts[key] = (correctionCounts[key] || 0) + 1;
  }
}

const companiesPath = path.join(dataDir, "companies.json");
const summaryPath = path.join(dataDir, "summary.json");
const auditPath = path.join(dataDir, "audit.json");
const qualityPath = path.join(dataDir, "media-quality.json");
let previousQuality = {};
try {
  previousQuality = JSON.parse(await readFile(qualityPath, "utf8"));
} catch {
  previousQuality = {};
}
const companies = JSON.parse(await readFile(companiesPath, "utf8"));
const excluded = [...(previousQuality.excluded || [])];

for (const company of companies) {
  company.media = company.media.flatMap((item) => {
    const bad = invalid.get(item.file);
    if (bad) {
      if (!excluded.some((entry) => entry.file === bad.file))
        excluded.push({
          companyId: company.id,
          company: company.name,
          order: item.order,
          ...bad,
        });
      return [];
    }
    const corrected = pathMap.get(item.file);
    if (corrected) {
      const kind = path.extname(corrected).slice(1);
      return [{ ...item, file: corrected, type: mimeByKind[kind] }];
    }
    return [item];
  });
}

const referenced = companies.flatMap((company) => company.media);
for (const item of referenced) {
  const diskPath = path.join(root, "public", item.file.replace(/^\//, ""));
  if (!(await exists(diskPath)))
    throw new Error(`Referencia sin archivo: ${item.file}`);
  const buffer = await readFile(diskPath);
  const kind = detectKind(buffer);
  if (kind !== path.extname(diskPath).slice(1).toLowerCase())
    throw new Error(`Extensión todavía incorrecta: ${item.file}`);
  if (kind === "svg" && invalidSvgReason(buffer))
    throw new Error(`SVG inválido todavía publicado: ${item.file}`);
}

const media = referenced.length;
const withMedia = companies.filter((company) => company.media.length).length;
const correctedFileTypes =
  Number(previousQuality.correctedFileTypes || 0) + pathMap.size;
const cumulativeCorrectionCounts = {
  ...(previousQuality.correctionCounts || {}),
};
for (const [key, value] of Object.entries(correctionCounts))
  cumulativeCorrectionCounts[key] =
    (cumulativeCorrectionCounts[key] || 0) + value;
const summary = JSON.parse(await readFile(summaryPath, "utf8"));
const audit = JSON.parse(await readFile(auditPath, "utf8"));
const quality = {
  generatedAt: new Date().toISOString(),
  status: "VERIFICADO",
  referencedMedia: media,
  correctedFileTypes,
  correctionCounts: cumulativeCorrectionCounts,
  technicalArtifactsExcluded: excluded.length,
  excluded,
  rule: "Los rastros técnicos inválidos se conservan fuera del directorio público y no se presentan como evidencia visual.",
};

Object.assign(summary, {
  media,
  withMedia,
  technicalArtifactsExcluded: excluded.length,
  mediaFileTypeCorrections: correctedFileTypes,
});
Object.assign(summary.completion, {
  availableEvidencePlaced: media,
  technicalArtifactsExcluded: excluded.length,
});
Object.assign(audit.completion, {
  availableEvidencePlaced: media,
  technicalArtifactsExcluded: excluded.length,
});
audit.mediaQuality = {
  status: "VERIFICADO",
  correctedFileTypes,
  technicalArtifactsExcluded: excluded.length,
  publicMediaValidated: media,
};
if (
  !audit.notes.includes(
    "Los rastros técnicos inválidos se excluyeron de las galerías y se conservaron fuera del directorio público.",
  )
) {
  audit.notes.push(
    "Los rastros técnicos inválidos se excluyeron de las galerías y se conservaron fuera del directorio público.",
  );
}

await Promise.all([
  writeFile(companiesPath, JSON.stringify(companies)),
  writeFile(summaryPath, JSON.stringify(summary)),
  writeFile(auditPath, JSON.stringify(audit)),
  writeFile(qualityPath, JSON.stringify(quality, null, 2)),
]);

console.log(
  JSON.stringify(
    {
      correctedFileTypes,
      correctionCounts: cumulativeCorrectionCounts,
      technicalArtifactsExcluded: excluded.length,
      publicMediaValidated: media,
      companiesWithMedia: withMedia,
    },
    null,
    2,
  ),
);
