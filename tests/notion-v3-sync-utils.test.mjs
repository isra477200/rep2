import test from "node:test";
import assert from "node:assert/strict";
import {
  auditContentAction,
  auditRanges,
  parseFetchedPage,
  parsePropertyTypes,
  privacyReplacements,
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
