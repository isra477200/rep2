import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import sharp from "sharp";
import { CAMPAIGNS, CAPTURE_UNITS, CREATIVES, CREATIVE_FORMATS } from "../app/ejecucion/catalog.ts";
import { LANDING_BLUEPRINTS } from "../app/ejecucion/landing-blueprints.ts";

const repoRoot = process.cwd();
const workspaceRoot = resolve(repoRoot, "../..");
const publicRoot = join(repoRoot, "public");
const publicPackageRoot = join(publicRoot, "assets", "ejecucion", "packages");
const outputRoot = resolve(repoRoot, "..", "entregables-redvitalia");
const stagingRoot = join(workspaceRoot, "work", "delivery-pack-staging");

const ensure = (path) => mkdirSync(path, { recursive: true });
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const xml = (value) => String(value).replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]);
const publicFile = (webPath) => join(publicRoot, webPath.replace(/^\//, "").replaceAll("/", "\\"));
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

const safeLink = (source, target) => {
  ensure(dirname(target));
  try { linkSync(source, target); } catch { copyFileSync(source, target); }
};

const humanBytes = (bytes) => bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.ceil(bytes / 1024)} KB`;

const campaignReadme = (campaign, unit, landing, creatives) => `# Paquete ${campaign.id}

## Qué contiene

- Briefing completo de campaña en \`campana.json\`.
- Propuesta de landing en \`landing.json\`.
- Inventario de archivos en \`inventario-creativo.csv\`.
- ${creatives.length} conceptos y ${creatives.length * CREATIVE_FORMATS.length} imágenes JPG reales en \`creatividades/\`.

## Objetivo

${campaign.objective}

## Público

${campaign.audience}

## Oferta

${campaign.offer}

## Landing propuesta

${landing ? `/landings/${landing.slug}` : campaign.landing}

## Conversión principal

\`${campaign.primaryConversion}\`

## Estado honesto

El contenido, la estructura y las adaptaciones visuales están preparados para revisión. No se deben publicar hasta incorporar la marca real del cliente, pruebas autorizadas, datos operativos, privacidad y aprobación humana. Los archivos de vídeo no se presentan como terminados: el paquete conserva únicamente guion, storyboard y fotogramas cuando corresponde.

## Restricción sectorial

${unit.compliance}
`;

const buildPackage = (campaign) => {
  const unit = CAPTURE_UNITS.find((item) => item.id === campaign.unitId);
  const creatives = CREATIVES.filter((item) => item.campaignId === campaign.id);
  const landing = LANDING_BLUEPRINTS.find((item) => item.unitId === campaign.unitId && item.mode === campaign.mode);
  const stage = join(stagingRoot, campaign.id);
  const creativeDir = join(stage, "creatividades");
  ensure(creativeDir);

  writeFileSync(join(stage, "README.md"), campaignReadme(campaign, unit, landing, creatives));
  writeFileSync(join(stage, "campana.json"), json(campaign));
  writeFileSync(join(stage, "landing.json"), json(landing || { pendiente: true, route: campaign.landing }));
  writeFileSync(join(stage, "estado.json"), json({
    packageId: campaign.id,
    ready: ["briefing", "landing_blueprint", "creative_copy", "42_jpg_assets", "measurement_map"],
    requiresClient: ["brand_kit", "legal_identity", "authorized_proof", "coverage", "capacity", "budget", "approval"],
    publication: "blocked_until_human_approval",
  }));

  const rows = [["concepto_id", "titular", "ruta", "formato", "ancho", "alto", "archivo", "estado"]];
  for (const creative of creatives) {
    for (const adaptation of creative.adaptations) {
      const source = publicFile(adaptation.file);
      const targetName = basename(source);
      copyFileSync(source, join(creativeDir, targetName));
      rows.push([creative.id, creative.headline, creative.route, adaptation.name, adaptation.width, adaptation.height, targetName, creative.status]);
    }
  }
  writeFileSync(join(stage, "inventario-creativo.csv"), rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n");

  const zipPath = join(publicPackageRoot, `${campaign.id}.zip`);
  execFileSync("tar", ["-a", "-cf", zipPath, "-C", stage, "."], { stdio: "inherit" });
  const size = statSync(zipPath).size;
  return {
    id: campaign.id,
    unitId: campaign.unitId,
    unit: campaign.unit,
    mode: campaign.mode,
    channel: campaign.channel,
    objective: campaign.objective,
    landing: landing ? `/landings/${landing.slug}` : campaign.landing,
    zip: `/assets/ejecucion/packages/${campaign.id}.zip`,
    files: creatives.length * CREATIVE_FORMATS.length + 5,
    images: creatives.length * CREATIVE_FORMATS.length,
    concepts: creatives.length,
    size,
    sizeLabel: humanBytes(size),
    sha256: sha256(zipPath),
    status: "Contenido listo · marca y aprobación pendientes",
  };
};

const buildContactSheet = async (manifest) => {
  const width = 1600;
  const columns = 4;
  const cellWidth = 400;
  const cellHeight = 292;
  const height = Math.ceil(manifest.length / columns) * cellHeight;
  const composite = [];
  for (let index = 0; index < manifest.length; index += 1) {
    const item = manifest[index];
    const creative = CREATIVES.find((entry) => entry.campaignId === item.id);
    const imageBuffer = await sharp(publicFile(creative.thumbnail)).resize(360, 210, { fit: "cover" }).jpeg({ quality: 86 }).toBuffer();
    const left = (index % columns) * cellWidth + 20;
    const top = Math.floor(index / columns) * cellHeight + 18;
    const label = `<svg width="360" height="52" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="52" fill="#ffffff"/><text x="0" y="19" fill="#10213a" font-family="Arial" font-size="15" font-weight="700">${xml(item.unit.slice(0, 36))}</text><text x="0" y="41" fill="#63738a" font-family="Arial" font-size="12">${item.mode} · 42 JPG · ${xml(item.sizeLabel)}</text></svg>`;
    composite.push({ input: imageBuffer, left, top });
    composite.push({ input: Buffer.from(label), left, top: top + 218 });
  }
  await sharp({ create: { width, height, channels: 3, background: "#eef2f7" } })
    .composite(composite)
    .jpeg({ quality: 88, progressive: true })
    .toFile(join(outputRoot, "MAPA-VISUAL-24-PAQUETES.jpg"));
};

const galleryHtml = (manifest) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Entrega RedVitalia · 24 paquetes</title><style>
*{box-sizing:border-box}body{margin:0;color:#122238;background:#eef2f7;font:16px/1.5 Arial,sans-serif}header{padding:48px max(24px,6vw);color:#fff;background:#0d2341}header p{max-width:780px;color:#bac9dc}header h1{max-width:900px;margin:8px 0 12px;font-size:clamp(34px,6vw,68px);line-height:1;letter-spacing:-.05em}.stats{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.stats span{padding:9px 12px;border:1px solid #ffffff2b;border-radius:6px;background:#ffffff0e}.note{margin:24px max(24px,6vw) 0;padding:15px;border-left:4px solid #e5a729;background:#fff8e6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(285px,1fr));gap:16px;padding:24px max(24px,6vw) 60px}.card{overflow:hidden;border:1px solid #d6dfe9;border-radius:8px;background:#fff;box-shadow:0 10px 28px #1836530e}.card img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover}.body{padding:17px}.tag{color:#0b57d0;font-size:12px;font-weight:800}.card h2{margin:7px 0;font-size:19px;line-height:1.2}.card p{min-height:48px;color:#617187;font-size:13px}.card a{display:flex;min-height:44px;align-items:center;justify-content:center;border-radius:6px;color:#fff;background:#0b57d0;font-size:14px;font-weight:800;text-decoration:none}.meta{display:flex;justify-content:space-between;margin:12px 0;color:#718096;font-size:12px}@media(max-width:600px){header{padding-top:34px}.grid{padding-inline:14px}.note{margin-inline:14px}}
</style></head><body><header><small>ENTREGA OPERATIVA · 03/09/2026</small><h1>RedVitalia: 24 paquetes listos para revisión.</h1><p>Cada ZIP contiene briefing, propuesta de landing, inventario y 42 imágenes reales. Marca, prueba y publicación permanecen bloqueadas hasta aprobación del cliente.</p><div class="stats"><span>24 campañas</span><span>1.008 JPG</span><span>144 conceptos</span><span>27 landings</span></div></header><div class="note"><b>Estado honesto:</b> producción preparada; logos, pruebas, datos legales y publicación requieren validación humana.</div><main class="grid">${manifest.map((item) => `<article class="card"><img src="previews/${item.id}.webp" alt="Vista previa de ${xml(item.unit)}"><div class="body"><span class="tag">${item.mode} · ${xml(item.channel)}</span><h2>${xml(item.unit)}</h2><p>${xml(item.objective)}</p><div class="meta"><span>${item.images} imágenes</span><span>${item.sizeLabel}</span></div><a href="paquetes/${item.id}.zip" download>Descargar paquete ZIP</a></div></article>`).join("")}</main></body></html>`;

rmSync(publicPackageRoot, { recursive: true, force: true });
rmSync(outputRoot, { recursive: true, force: true });
rmSync(stagingRoot, { recursive: true, force: true });
ensure(publicPackageRoot);
ensure(join(outputRoot, "paquetes"));
ensure(join(outputRoot, "previews"));
ensure(stagingRoot);

const manifest = CAMPAIGNS.map(buildPackage);
for (const item of manifest) {
  safeLink(join(publicPackageRoot, `${item.id}.zip`), join(outputRoot, "paquetes", `${item.id}.zip`));
  const creative = CREATIVES.find((entry) => entry.campaignId === item.id);
  copyFileSync(publicFile(creative.thumbnail), join(outputRoot, "previews", `${item.id}.webp`));
}

const inventoryRows = [
  ["paquete", "especialidad", "tipo", "canal", "conceptos", "imagenes", "archivos", "tamano", "sha256", "estado"],
  ...manifest.map((item) => [item.id, item.unit, item.mode, item.channel, item.concepts, item.images, item.files, item.sizeLabel, item.sha256, item.status]),
];
writeFileSync(join(publicRoot, "assets", "ejecucion", "delivery-manifest.json"), json({ generatedAt: new Date().toISOString(), totals: { packages: manifest.length, concepts: CREATIVES.length, images: CREATIVES.length * CREATIVE_FORMATS.length, landings: LANDING_BLUEPRINTS.length }, packages: manifest }));
writeFileSync(join(outputRoot, "INVENTARIO.json"), json({ generatedAt: new Date().toISOString(), packages: manifest }));
writeFileSync(join(outputRoot, "INVENTARIO.csv"), inventoryRows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n");
writeFileSync(join(outputRoot, "INDEX.html"), galleryHtml(manifest));
writeFileSync(join(outputRoot, "LEEME.md"), `# Entrega RedVitalia\n\nAbre \`INDEX.html\` para revisar visualmente los 24 paquetes y descargarlos uno por uno.\n\n- 24 paquetes ZIP independientes.\n- 144 conceptos creativos.\n- 1.008 imágenes JPG en siete formatos físicos.\n- Briefing, landing, estado e inventario dentro de cada ZIP.\n- Hash SHA-256 de cada paquete en \`INVENTARIO.csv\`.\n\n## Importante\n\nLa producción está preparada para revisión, no para publicación automática. Faltan por campaña los datos reales del cliente, brand kit, pruebas autorizadas, privacidad y aprobación humana.\n`);
await buildContactSheet(manifest);
rmSync(stagingRoot, { recursive: true, force: true });

const publicZips = readdirSync(publicPackageRoot).filter((name) => name.endsWith(".zip"));
if (publicZips.length !== CAMPAIGNS.length) throw new Error(`Paquetes incompletos: ${publicZips.length}/${CAMPAIGNS.length}`);
if (manifest.some((item) => item.images !== 42 || !existsSync(join(outputRoot, "paquetes", `${item.id}.zip`)))) throw new Error("Inventario de entrega incompleto");

console.log(`Entrega creada: ${outputRoot}`);
console.log(`${manifest.length} ZIP · ${CREATIVES.length * CREATIVE_FORMATS.length} JPG inventariados · ${LANDING_BLUEPRINTS.length} landings`);
