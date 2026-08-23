/* eslint-disable @typescript-eslint/no-unused-expressions, no-empty, no-useless-escape -- se evalúa como función aislada dentro del orquestador MCP. */
(async function runNotionV3Sync(ctx) {
  const { tools, workdir, loadSchemaResult, batchSize = 20, rounds = 1, concurrency = 5, onProgress, ids = [], verifyOnly = false } = ctx;

  function resultText(result) {
    for (const block of result?.content || []) {
      if (block?.type !== "text" || typeof block.text !== "string") continue;
      try {
        const parsed = JSON.parse(block.text);
        if (typeof parsed?.text === "string") return parsed.text;
      } catch {}
      return block.text;
    }
    return "";
  }

  function parsePage(result) {
    const wrapper = resultText(result);
    const properties = wrapper.match(/<properties>\r?\n([\s\S]*?)\r?\n<\/properties>/);
    const content = wrapper.match(/<content>\r?\n([\s\S]*?)\r?\n<\/content>/);
    if (!properties || !content) throw new Error("La lectura de la ficha llegó incompleta.");
    return { properties: JSON.parse(properties[1]), content: content[1] };
  }

  function propertyTypes(result) {
    const match = resultText(result).match(/<data-source-state>\r?\n([\s\S]*?)\r?\n<\/data-source-state>/);
    if (!match) throw new Error("No se pudo leer el esquema canónico.");
    const state = JSON.parse(match[1]);
    return new Map(Object.entries(state.schema || {}).map(([name, definition]) => [name, definition.type]));
  }

  const types = propertyTypes(loadSchemaResult);
  const auditHeading = /^[ \t]*## (?:🧬 Auditoría forense comercial V2|🧠 Auditoría comercial profunda · RedVitalia)[^\r\n]*$/gm;
  const levelTwoHeading = /^[ \t]*## (?!#)[^\r\n]*$/gm;
  const v3EndMarker = "La información íntegra y ampliable permanece en esta ficha madre";

  function auditRanges(content) {
    const starts = [...content.matchAll(auditHeading)].map((match) => match.index);
    const headings = [...content.matchAll(levelTwoHeading)].map((match) => match.index);
    return starts.map((start) => {
      const marker = content.indexOf(v3EndMarker, start);
      const close = marker >= 0 ? content.indexOf("</callout>", marker) : -1;
      return { start, end: close >= 0 ? close + "</callout>".length : headings.find((heading) => heading > start) ?? content.length };
    });
  }

  function covered(index, ranges) {
    return ranges.some((range) => index >= range.start && index < range.end);
  }

  function privacyReplacements(content, excludedRanges = []) {
    const candidates = [];
    const add = (pattern, replacement) => {
      for (const match of content.matchAll(pattern)) {
        if (covered(match.index, excludedRanges)) continue;
        const next = typeof replacement === "function" ? replacement(match) : replacement;
        if (match[0] !== next) candidates.push({ old_str: match[0], new_str: next, replace_all_matches: true });
      }
    };
    add(/^.*\\?<mention-(?:page|database|data-source)\b.*$/gmi, "Referencia interna retirada por privacidad");
    add(/<mention-(?:page|database|data-source)\b[^>]*>([\s\S]*?)<\/mention-(?:page|database|data-source)>/gi, (match) => match[1].trim() || "Referencia retirada por privacidad");
    add(/<mention-(?:page|database|data-source)\b[^>]*\/>/gi, "Referencia retirada por privacidad");
    add(/\[([^\]]+)\]\((?:https?:\/\/)?(?:[\w-]+\.)?(?:notion\.(?:so|com)|notion\.site)[^)]*\)/gi, (match) => match[1]);
    add(/<(?:https?:\/\/)?(?:[\w-]+\.)?(?:notion\.(?:so|com)|notion\.site)[^>]*>/gi, "");
    add(/(?:https?:\/\/)?(?:[\w-]+\.)?(?:notion\.(?:so|com)|notion\.site)\/[^\s)\]}>]*/gi, "");
    add(/Puente\s+(?:de\s+)?IA/gi, "RedVitalia");
    add(/Radar\s+Competitivo/gi, "Inteligencia Mundial de Captación");
    add(/Universo\s+Activo/gi, "Inteligencia Mundial de Captación");
    add(/Esta fila evita que el actor vuelva a quedar fuera del (?:\*\*)?Radar(?:\*\*)?\. La existencia de la fuente y su asignación territorial proceden del barrido del 15–16\/08\/2026\. Oferta, precio, contrato, prueba, identidad visual, Meta Ads, Google Ads y funnel permanecen explícitamente pendientes hasta su auditoría individual; no se infieren datos ausentes\./gi, "Esta ficha forma parte de la cobertura mundial consolidada. La fuente y su asignación territorial proceden del barrido público del 15–16/08/2026. La auditoría comercial V3 está documentada al inicio de esta ficha; los datos no observables se mantienen expresamente limitados y no se completan con supuestos.");
    add(/[A-Z]:\\Users\\[^\r\n]*/gi, "Referencia privada retirada");
    add(/(?<![:\w])\/Users\/[^\r\n]*/gi, "Referencia privada retirada");
    add(/\.codex(?:[\\/][^\s)\]}>]*)?/gi, "");
    add(/agent-handoffs(?:[\\/][^\s)\]}>]*)?/gi, "");
    add(/research[\\/]deep(?:[\\/][^\s)\]}>]*)?/gi, "");
    add(/manual-(?:wave|pilot)(?:[\\/][^\s)\]}>]*)?/gi, "");
    add(/RedVitaliaMarketResearch/gi, "investigación pública RedVitalia");
    add(/\b(?:RVC|RV-PUB)-[A-Za-z0-9-]+\b/gi, "referencia catalogada");
    add(/\b(?:META-|GOOGLE-)?AGREGADO-\d+\b/gi, "Resultados agregados sin ID individual");
    add(/fuente\s+de\s+trabajo(?:\s+previa)?(?:\s+consolidada)?/gi, "evidencia pública consolidada");
    add(/Bandeja\s+de\s+registro/gi, "registro de investigación");
    add(/Origen\s+(?:de\s+la\s+)?migraci[oó]n/gi, "procedencia documentada");
    const unique = new Map();
    for (const candidate of candidates) {
      const key = `${candidate.old_str}\u0000${candidate.new_str}`;
      if (!unique.has(key)) unique.set(key, candidate);
    }
    return [...unique.values()];
  }

  function privateReference() {
    return /(?:<mention-(?:page|database|data-source)\b|(?:https?:\/\/)?(?:[\w-]+\.)?(?:notion\.(?:so|com)|notion\.site)\b|Puente\s+(?:de\s+)?IA|Radar\s+Competitivo|Universo\s+Activo|fuera\s+del\s+(?:\*\*)?Radar|[A-Z]:\\Users\\|(?<![:\w])\/Users\/|\.codex|agent-handoffs|research[\\/]deep|manual-(?:wave|pilot)|RedVitaliaMarketResearch|\b(?:RVC|RV-PUB)-[A-Za-z0-9-]+\b|\b(?:META-|GOOGLE-)?AGREGADO-\d+\b|fuente\s+de\s+trabajo|Bandeja\s+de\s+registro|Origen\s+(?:de\s+la\s+)?migraci[oó]n)/i;
  }

  function serializeProperties(properties) {
    const output = {};
    for (const [name, value] of Object.entries(properties)) {
      output[name] = typeof value === "string" && ["text", "title"].includes(types.get(name))
        ? value.replace(/\/remove:yes:/gi, "/remove — yes:").replace(/([\\_*~`$<>{}|^]|\[|\])/g, "\\$1")
        : value;
    }
    return output;
  }

  function scrubProperties(properties) {
    const output = {};
    for (const [name, value] of Object.entries(properties)) {
      if (types.get(name) === "relation" && ["Anuncios hijos", "Ficha madre", "Tarea operativa vinculada"].includes(name) && Array.isArray(value) && value.length) {
        output[name] = null;
        continue;
      }
      if (typeof value !== "string" || !["text", "url", "title"].includes(types.get(name)) || !privateReference().test(value)) continue;
      let cleaned = value;
      for (const update of privacyReplacements(value)) cleaned = cleaned.split(update.old_str).join(update.new_str);
      output[name] = cleaned.trim();
    }
    return output;
  }

  function taskId(result) {
    for (const candidate of [result?.structuredContent, result]) {
      const task = candidate?.async_task;
      if (task) return task.task_id || task.id;
    }
    for (const block of result?.content || []) {
      if (block.type !== "text") continue;
      try {
        const task = JSON.parse(block.text)?.async_task;
        if (task) return task.task_id || task.id;
      } catch {}
    }
    return null;
  }

  async function settle(result) {
    if (result?.isError) {
      throw new Error(`Notion rechazó la operación: ${resultText(result).slice(0, 500)}`);
    }
    const id = taskId(result);
    if (!id) return result;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 220 + Math.min(900, attempt * 45)));
      result = await tools.mcp__codex_apps__notion_notion_get_async_task({ task_id: id });
      if (result?.isError) {
        throw new Error(`No se pudo consultar la tarea de Notion: ${resultText(result).slice(0, 500)}`);
      }
      let parsed;
      try { parsed = JSON.parse(resultText(result)); } catch {}
      const status = parsed?.status || parsed?.async_task?.status || result?.structuredContent?.status || result?.structuredContent?.async_task?.status;
      if (status === "succeeded") return result;
      if (status === "failed") throw new Error(`Notion rechazó la tarea: ${resultText(result).slice(0, 250)}`);
    }
    throw new Error(`La tarea de Notion no confirmó a tiempo: ${id}`);
  }

  function canonical(value) {
    let output = String(value ?? "").replace(/\r\n/g, "\n").replace(/[\u200B-\u200D\uFEFF]/g, "");
    output = output
      .replace(/\[\*\*(https?:\/\/[^\r\n]+)\*\*\]\(\1\)/gi, "$1")
      .replace(/\[(https?:\/\/[^\r\n]+)\]\(\1\)/gi, "$1")
      .replace(/\[([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\]\(mailto:\1\)/gi, "$1")
      .replace(/\[((?:[A-Z0-9-]+\.)+[A-Z]{2,}[^\r\n]*)\]\(https?:\/\/\1\)/gi, "$1");
    output = output.replace(/\[((?:\\.|[^\]\\\r\n])*)\]\((mailto:|https?:\/\/)([^)\r\n]+)\)/gi, (whole, label, scheme, destination) => {
      const cleanLabel = label.replace(/^\*\*|\*\*$/g, "").replace(/\\([\\_*~`$<>{}|:^\[\]])/g, "$1");
      const comparableLabel = cleanLabel.replace(/\/$/, "").toLowerCase();
      const comparableDestination = destination.replace(/\/$/, "").toLowerCase();
      const fullDestination = `${scheme}${destination}`.replace(/\/$/, "").toLowerCase();
      return [comparableDestination, comparableDestination.replace(/^www\./, ""), fullDestination].includes(comparableLabel) ? cleanLabel : whole;
    });
    output = output.replace(/\[([^\[\]\r\n]+)\]\((mailto:|https?:\/\/)([^)\r\n]+)\)/gi, (whole, label, scheme, destination) => {
      const cleanLabel = label.replace(/^\*\*|\*\*$/g, "").replace(/\\([\\_*~`$<>{}|:^\[\]])/g, "$1");
      const comparableLabel = cleanLabel.replace(/\/$/, "").toLowerCase();
      const comparableDestination = destination.replace(/\/$/, "").toLowerCase();
      const fullDestination = `${scheme}${destination}`.replace(/\/$/, "").toLowerCase();
      return [comparableDestination, comparableDestination.replace(/^www\./, ""), fullDestination].includes(comparableLabel) ? cleanLabel : whole;
    });
    output = output.replace(/\*\*((?:https?:\/\/)?(?:[A-Z0-9-]+\.)+[A-Z]{2,}(?:\/[^\s*]*)?|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\*\*/gi, "$1");
    output = output.replace(/<td>[\s\S]*?<\/td>/gi, (cell) =>
      cell.replace(/(?<=\S) {2}\u2022 (?=\S)/g, " - "),
    );
    return output
      .replace(/\\([\\_*~`$<>{}|:^\[\]])/g, "$1")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function equal(expected, actual) {
    if (expected === null) return actual == null || (Array.isArray(actual) && !actual.length);
    if (Array.isArray(expected)) return JSON.stringify(expected) === JSON.stringify(actual);
    if (typeof expected === "string") return canonical(expected) === canonical(actual);
    return expected === actual;
  }

  async function shell(command, maxOutputTokens = 30_000) {
    const result = await tools.exec_command({ cmd: command, workdir, yield_time_ms: 10_000, max_output_tokens: maxOutputTokens });
    if (result.exit_code !== 0) throw new Error(result.output);
    return result.output.trim();
  }

  async function loadRecord(meta) {
    let serialized = "";
    for (let start = 0; start < meta.serializedLength; start += 12_000) {
      const response = JSON.parse(await shell(`node scripts/read-notion-v3-plan.mjs --record=${meta.id} --start=${start} --length=12000`));
      if (response.id !== meta.id || response.start !== start || response.total !== meta.serializedLength) throw new Error(`Fragmento inconsistente: ${meta.name}`);
      serialized += response.chunk;
    }
    if (serialized.length !== meta.serializedLength) throw new Error(`Expediente truncado: ${meta.name}`);
    const record = JSON.parse(serialized);
    if (record.digest !== meta.digest) throw new Error(`Digest cambió durante la lectura: ${meta.name}`);
    return record;
  }

  async function fetchPage(id) {
    return parsePage(await tools.mcp__codex_apps__notion_fetch({ id }));
  }

  async function waitForAuditCount(id, expected) {
    let page;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      page = await fetchPage(id);
      if (auditRanges(page.content).length === expected) return page;
      await new Promise((resolve) => setTimeout(resolve, 300 + attempt * 100));
    }
    throw new Error(`Notion no estabilizó ${expected} sección(es) V3/V2.`);
  }

  function verify(record, page) {
    const ranges = auditRanges(page.content);
    const v3 = (page.content.match(/^## 🧠 Auditoría comercial profunda · RedVitalia[^\r\n]*$/gm) || []).length;
    const v2 = (page.content.match(/^## 🧬 Auditoría forense comercial V2[^\r\n]*$/gm) || []).length;
    if (v3 !== 1 || v2 !== 0 || ranges.length !== 1) throw new Error(`Secciones V3/V2/rangos: ${v3}/${v2}/${ranges.length}`);
    const actualSection = page.content.slice(ranges[0].start, ranges[0].end).trimEnd();
    if (canonical(actualSection) !== canonical(record.section)) throw new Error("La sección releída no es semánticamente idéntica.");
    const mismatched = [];
    for (const [name, expected] of Object.entries(record.properties)) if (!equal(expected, page.properties[name])) mismatched.push(name);
    if (mismatched.length) throw new Error(`Propiedades distintas: ${mismatched.join(", ")}`);
    for (const [name, value] of Object.entries(page.properties)) {
      if (["text", "url", "title"].includes(types.get(name)) && typeof value === "string" && privateReference().test(value)) throw new Error(`Referencia privada en ${name}`);
      if (types.get(name) === "relation" && Array.isArray(value) && value.length) throw new Error(`Relación interna expuesta: ${name}`);
    }
    if (privateReference().test(page.content)) throw new Error("Referencia privada en contenido.");
    if (/<(?:page|database)\b/i.test(page.content)) throw new Error("Subpágina o base embebida en ficha madre.");
    if (!actualSection.includes(`?empresa=${record.publicId}`) || !actualSection.includes(`/data/funnel-v3/records/${record.publicId}.json`)) throw new Error("Falta un acceso público canónico.");
  }

  function auditMutation(record, page) {
    const ranges = auditRanges(page.content);
    if (ranges.length > 1) throw new Error("La ficha necesita consolidación de auditorías duplicadas.");
    if (!ranges.length) return { page_id: record.id, command: "insert_content", content: record.section, position: { type: "start" }, allow_async: true, privacy: privacyReplacements(page.content) };
    return {
      page_id: record.id,
      command: "update_content",
      content_updates: [
        ...ranges.map((range, index) => ({ old_str: page.content.slice(range.start, range.end).trimEnd(), new_str: index === 0 ? record.section : "" })),
        ...privacyReplacements(page.content, ranges),
      ],
      allow_async: true,
      privacy: [],
    };
  }

  async function writeAuditConservatively(record, page) {
    const ranges = auditRanges(page.content);
    if (!ranges.length) {
      await settle(await tools.mcp__codex_apps__notion_notion_update_page({ page_id: record.id, command: "insert_content", content: record.section, position: { type: "start" }, allow_async: true }));
      return waitForAuditCount(record.id, 1);
    }
    if (ranges.length === 1) {
      await settle(await tools.mcp__codex_apps__notion_notion_update_page({ page_id: record.id, command: "update_content", content_updates: [{ old_str: page.content.slice(ranges[0].start, ranges[0].end).trimEnd(), new_str: record.section }], allow_async: true }));
      return waitForAuditCount(record.id, 1);
    }

    const uniqueSections = new Map();
    for (const range of ranges) {
      const old = page.content.slice(range.start, range.end).trimEnd();
      if (!uniqueSections.has(old)) uniqueSections.set(old, { old_str: old, new_str: "", replace_all_matches: true });
    }
    await settle(await tools.mcp__codex_apps__notion_notion_update_page({ page_id: record.id, command: "update_content", content_updates: [...uniqueSections.values()], allow_async: true }));
    await waitForAuditCount(record.id, 0);
    await settle(await tools.mcp__codex_apps__notion_notion_update_page({ page_id: record.id, command: "insert_content", content: record.section, position: { type: "start" }, allow_async: true }));
    return waitForAuditCount(record.id, 1);
  }

  async function slowSync(record) {
    const before = await fetchPage(record.id);
    const middle = await writeAuditConservatively(record, before);
    const privacy = privacyReplacements(middle.content, auditRanges(middle.content));
    if (privacy.length) await settle(await tools.mcp__codex_apps__notion_notion_update_page({ page_id: record.id, command: "update_content", content_updates: privacy, allow_async: true }));
    await settle(await tools.mcp__codex_apps__notion_notion_update_page({ page_id: record.id, command: "update_properties", properties: serializeProperties({ ...scrubProperties(before.properties), ...record.properties }), allow_async: true }));
    verify(record, await fetchPage(record.id));
  }

  async function syncRecord(record) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        if (attempt === 1) {
          const before = await fetchPage(record.id);
          if (auditRanges(before.content).length > 1) {
            await slowSync(record);
            return { id: record.id, name: record.name, ok: true, attempt };
          }
          const mutation = auditMutation(record, before);
          const privacy = mutation.privacy;
          delete mutation.privacy;
          await Promise.all([
            settle(await tools.mcp__codex_apps__notion_notion_update_page(mutation)),
            settle(await tools.mcp__codex_apps__notion_notion_update_page({ page_id: record.id, command: "update_properties", properties: serializeProperties({ ...scrubProperties(before.properties), ...record.properties }), allow_async: true })),
          ]);
          await waitForAuditCount(record.id, 1);
          if (privacy.length) {
            const middle = await fetchPage(record.id);
            const remaining = privacyReplacements(middle.content, auditRanges(middle.content));
            if (remaining.length) await settle(await tools.mcp__codex_apps__notion_notion_update_page({ page_id: record.id, command: "update_content", content_updates: remaining, allow_async: true }));
          }
          verify(record, await fetchPage(record.id));
        } else {
          await slowSync(record);
        }
        return { id: record.id, name: record.name, ok: true, attempt };
      } catch (error) {
        if (attempt === 3) return { id: record.id, name: record.name, ok: false, error: String(error?.message || error) };
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      }
    }
  }

  async function verifyRecord(record) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        verify(record, await fetchPage(record.id));
        return { id: record.id, name: record.name, ok: true, attempt };
      } catch (error) {
        if (attempt === 3) return { id: record.id, name: record.name, ok: false, error: String(error?.message || error) };
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  const failedIds = new Set();
  const processedIds = new Set();
  const allResults = [];
  for (let round = 1; round <= rounds; round += 1) {
    const selector = ids.length
      ? `--ids=${ids.join(",")}`
      : verifyOnly
        ? ""
        : `--pending --limit=${batchSize + failedIds.size}`;
    const manifest = JSON.parse(await shell(`node scripts/read-notion-v3-plan.mjs ${selector} --manifest`));
    const selected = manifest.filter((record) => !failedIds.has(record.id) && !processedIds.has(record.id)).slice(0, batchSize);
    if (!selected.length) break;
    const roundResults = [];
    for (let index = 0; index < selected.length; index += concurrency) {
      const metas = selected.slice(index, index + concurrency);
      const records = await Promise.all(metas.map(loadRecord));
      const results = await Promise.all(records.map(verifyOnly ? verifyRecord : syncRecord));
      roundResults.push(...results);
      const complete = results.filter((result) => result.ok).map((result) => result.id);
      const failed = results.filter((result) => !result.ok).map((result) => result.id);
      if (!verifyOnly && complete.length) await shell(`node scripts/mark-notion-v3.mjs --complete=${complete.join(",")}`, 500);
      if (!verifyOnly && failed.length) {
        failed.forEach((id) => failedIds.add(id));
        await shell(`node scripts/mark-notion-v3.mjs --failed=${failed.join(",")}`, 500);
      }
      results.forEach((result) => processedIds.add(result.id));
    }
    allResults.push(...roundResults);
    const pending = verifyOnly
      ? manifest.length - processedIds.size
      : Number(await shell("node -e \"const fs=require('fs'),q=JSON.parse(fs.readFileSync('research/deep/v3/queue.json','utf8')),p=JSON.parse(fs.readFileSync('research/deep/v3/notion-plan.json','utf8')),d=new Map(p.records.map(x=>[x.id,x.digest]));console.log(q.items.filter(x=>x.notion?.status!=='complete'||x.notion?.digest!==d.get(x.id)).length)\"", 100));
    if (onProgress) await onProgress({ round, passed: roundResults.filter((result) => result.ok).length, failed: roundResults.filter((result) => !result.ok).map((result) => ({ name: result.name, error: result.error })), pending });
  }
  return {
    mode: verifyOnly ? "verify" : "sync",
    processed: allResults.length,
    passed: allResults.filter((result) => result.ok).length,
    failed: allResults.filter((result) => !result.ok),
  };
})
