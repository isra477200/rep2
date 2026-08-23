import test from "node:test";
import assert from "node:assert/strict";
import {
  auditContentAction,
  auditRanges,
  parseFetchedPage,
  parsePropertyTypes,
  privacyReplacements,
  selectPlanRecords,
  serializePropertyUpdates,
  scrubPropertyUpdates,
  visiblePrivacyFindings,
} from "../scripts/notion-v3-sync-utils.mjs";

test("extrae solo las propiedades y el contenido visible del wrapper de Notion", () => {
  const result = { content: [{ type: "text", text: JSON.stringify({ text: `Cabecera privada
<page url="https://app.notion.com/private">
<ancestor-path>Radar Competitivo</ancestor-path>
<properties>
{"Registro":"Empresa","Logo oficial":["file://adjunto"]}
</properties>
<content>
## Público
Texto
</content>
</page>` }) }] };
  const page = parseFetchedPage(result);
  assert.equal(page.properties.Registro, "Empresa");
  assert.equal(page.content, "## Público\nTexto");
});

test("extrae los tipos editables del esquema canónico", () => {
  const result = { content: [{ type: "text", text: JSON.stringify({ text: `<data-source-state>
{"schema":{"Registro":{"type":"title"},"Fuentes":{"type":"text"},"Logo":{"type":"file"}}}
</data-source-state>` }) }] };
  assert.deepEqual([...parsePropertyTypes(result)], [["Registro", "title"], ["Fuentes", "text"], ["Logo", "file"]]);
});

test("reemplaza V2/V3 sin tragarse el siguiente bloque de nivel dos", () => {
  const content = `## Uno
Conservar
## 🧬 Auditoría forense comercial V2
Viejo
### Detalle
Viejo 2
## Después
También conservar`;
  const ranges = auditRanges(content);
  assert.equal(ranges.length, 1);
  assert.match(content.slice(ranges[0].start, ranges[0].end), /Viejo 2/);
  assert.doesNotMatch(content.slice(ranges[0].start, ranges[0].end), /Después/);
  const action = auditContentAction(content, "## 🧠 Auditoría comercial profunda · RedVitalia\nNueva");
  assert.equal(action.command, "update_content");
  assert.match(action.content_updates[0].old_str, /Auditoría forense/);
});

test("cierra V3 en su callout final aunque el siguiente H2 esté sangrado", () => {
  const section = "## 🧠 Auditoría comercial profunda · RedVitalia\nTexto\n<callout icon=\"✅\">\n\tLa información íntegra y ampliable permanece en esta ficha madre y en su expediente público.\n</callout>";
  const content = `${section}\n\t## Publicidad de pago\nConservar`;
  const action = auditContentAction(content, section.replace("Texto", "Nuevo"));
  assert.equal(action.content_updates[0].old_str, section);
});

test("inserta al principio cuando no hay auditoría previa", () => {
  const action = auditContentAction("## Histórico\nConservar", "## 🧠 Auditoría comercial profunda · RedVitalia\nNueva");
  assert.equal(action.command, "insert_content");
  assert.deepEqual(action.position, { type: "start" });
});

test("retira enlaces privados y nombres antiguos sin tocar el resto", () => {
  const value = "[documento](https://notion.so/private) · Puente de IA · Radar Competitivo · público";
  let cleaned = value;
  for (const update of privacyReplacements(value)) cleaned = cleaned.split(update.old_str).join(update.new_str);
  assert.equal(cleaned, "documento · RedVitalia · Inteligencia Mundial de Captación · público");
});

test("solo limpia propiedades de texto, URL o título", () => {
  const properties = {
    Registro: "Radar Competitivo",
    Fuentes: "https://app.notion.com/private",
    Logo: ["file://private"],
  };
  const types = new Map([["Registro", "title"], ["Fuentes", "text"], ["Logo", "file"]]);
  const updates = scrubPropertyUpdates(properties, types);
  assert.deepEqual(updates, { Registro: "Inteligencia Mundial de Captación", Fuentes: "" });
  assert.deepEqual(visiblePrivacyFindings(properties, "Contenido limpio", types), ["property:Registro", "property:Fuentes"]);
});

test("no confunde rutas públicas /users/ con rutas privadas del equipo", () => {
  const properties = {};
  const types = new Map();
  assert.deepEqual(visiblePrivacyFindings(properties, "https://example.com/users/sign_in", types), []);
  assert.deepEqual(visiblePrivacyFindings(properties, "C:\\Users\\privado\\.codex", types), ["content"]);
});

test("detecta y limpia las relaciones internas de las fichas madre", () => {
  const properties = {
    "Anuncios hijos": ["https://www.notion.so/privado"],
    "Ficha madre": [],
    "Tarea operativa vinculada": ["https://www.notion.so/tarea"],
  };
  const types = new Map([
    ["Anuncios hijos", "relation"],
    ["Ficha madre", "relation"],
    ["Tarea operativa vinculada", "relation"],
  ]);
  assert.deepEqual(scrubPropertyUpdates(properties, types), {
    "Anuncios hijos": null,
    "Tarea operativa vinculada": null,
  });
  assert.deepEqual(visiblePrivacyFindings(properties, "Contenido limpio", types), [
    "property:Anuncios hijos",
    "property:Tarea operativa vinculada",
  ]);
});

test("sustituye el párrafo heredado de Radar sin tocar usos competitivos legítimos", () => {
  const legacy = "> Esta fila evita que el actor vuelva a quedar fuera del Radar. La existencia de la fuente y su asignación territorial proceden del barrido del 15–16/08/2026. Oferta, precio, contrato, prueba, identidad visual, Meta Ads, Google Ads y funnel permanecen explícitamente pendientes hasta su auditoría individual; no se infieren datos ausentes.";
  let cleaned = legacy;
  for (const update of privacyReplacements(legacy)) cleaned = cleaned.split(update.old_str).join(update.new_str);
  assert.match(cleaned, /cobertura mundial consolidada/);
  assert.doesNotMatch(cleaned, /Radar|pendientes hasta su auditoría/);
  assert.deepEqual(privacyReplacements("Radar Summum y signal radar son evidencia pública."), []);
});

test("la reanudación limita después de retirar los ya completos", () => {
  const queue = [
    { id: "a", notion: { status: "complete", digest: "1" } },
    { id: "b", notion: { status: "complete", digest: "2" } },
    { id: "c", notion: { status: "pending" } },
    { id: "d", notion: { status: "pending" } },
  ];
  assert.deepEqual(
    selectPlanRecords(
      [{ id: "a", digest: "1" }, { id: "b", digest: "2" }, { id: "c", digest: "3" }, { id: "d", digest: "4" }],
      queue,
      { pendingOnly: true, limit: 1 },
    ),
    [{ id: "c", digest: "3" }],
  );
});

test("un digest nuevo reabre una ficha previamente completa", () => {
  const records = [{ id: "a", digest: "nuevo" }];
  const queue = [{ id: "a", notion: { status: "complete", digest: "antiguo" } }];
  assert.deepEqual(selectPlanRecords(records, queue, { pendingOnly: true }), records);
});

test("serializa solo rich text y títulos sin alterar URL, select ni números", () => {
  const properties = {
    Texto: "USD $5 *neto* [fuente] _ga /remove:yes:",
    Titulo: "Marca *",
    Url: "https://example.com/?price[]=5",
    Estado: "Completa",
    Total: 5,
  };
  const types = new Map([
    ["Texto", "text"],
    ["Titulo", "title"],
    ["Url", "url"],
    ["Estado", "select"],
    ["Total", "number"],
  ]);
  assert.deepEqual(serializePropertyUpdates(properties, types), {
    Texto: "USD \\$5 \\*neto\\* \\[fuente\\] \\_ga /remove — yes:",
    Titulo: "Marca \\*",
    Url: "https://example.com/?price[]=5",
    Estado: "Completa",
    Total: 5,
  });
});
