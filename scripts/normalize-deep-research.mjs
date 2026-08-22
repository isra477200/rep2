import { readFile, rename, writeFile } from "node:fs/promises";

const QUEUE_FILE = "research/deep/queue.json";

const explanations = {
  "Mensaje principal": "No se recuperó un titular principal suficientemente legible en las páginas públicas accesibles.",
  CTA: "No se localizó un CTA inequívoco en el HTML público recuperado; puede existir en contenido dinámico o tras autenticación.",
  Formulario: "No se observó un formulario HTML recuperable; puede cargarse con JavaScript o aparecer después de un CTA.",
  "Reserva/contacto": "No se observó una vía pública inequívoca de reserva o contacto en las páginas recuperadas.",
  "Objeciones / FAQ": "No se localizaron objeciones o preguntas frecuentes explícitas en las páginas públicas revisadas.",
  "Lead magnet": "No se localizó un recurso descargable o incentivo de captación explícito en las páginas públicas revisadas.",
  "Tecnología comercial": "No se detectó una firma técnica comercial reconocible en scripts, iframes, enlaces o formularios públicos; esto no demuestra que no exista.",
  Equipo: "No se recuperó una presentación pública suficientemente clara del equipo en las páginas revisadas.",
  "Legal / confianza": "No se localizó evidencia legal o de confianza suficientemente legible en las páginas recuperadas; puede existir en otra ruta o jurisdicción.",
  "Seguimiento posterior": "No se enviaron formularios ni datos personales, por lo que el seguimiento posterior no es observable.",
  "Conversación de ventas": "No se contactó con la empresa, por lo que la conversación de ventas no es observable.",
  Propuesta: "No se solicitó una propuesta; la fase privada de propuesta no es observable.",
  Cierre: "No se realizó ninguna compra ni negociación; el cierre privado no es observable.",
  "Onboarding / entrega": "No se contrató el servicio; el onboarding y la entrega no son observables.",
};

function sanitizeMarkdownLinks(value) {
  if (typeof value === "string") {
    return value.replace(/\[([^\]]+)]\((https?:\/\/[^)]+)\)/g, "$1 — $2");
  }
  if (Array.isArray(value)) return value.map(sanitizeMarkdownLinks);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitizeMarkdownLinks(child)]));
  }
  return value;
}

function isStrongCheckoutForm(form) {
  const action = String(form?.action || "");
  const submit = String(form?.submitText || "").trim();
  const paymentRoute = /\/(?:checkout|cart|payment|pay-now|buy-now)(?:[/?#]|$)|stripepay|razorpay|paypal/i.test(action);
  const paymentSubmit = /^(?:buy(?: now)?|purchase(?: now)?|pay(?: now)?|checkout|add to cart|comprar(?: ahora)?|pagar(?: ahora)?|finalizar compra|proceder al pago|beli|購入|支払|결제|شراء|ادفع)(?:\b|\s|$)/i.test(submit);
  return paymentRoute || paymentSubmit;
}

function hasContactField(form) {
  return (form?.fields || []).some((field) => /email|e-mail|mail|phone|tel|mobile|whatsapp|name|nombre|nom|company|empresa|message|mensaje|budget|presupuesto|website|sitio|url|textarea/i.test(`${field.type || ""} ${field.name || ""} ${field.label || ""} ${field.placeholder || ""}`));
}

function uniqueObjects(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeConversionEvidence(record) {
  const conversion = record.commercialForensics?.conversion;
  if (!conversion || !Array.isArray(record.pages)) return { formsReclassified: 0, checkoutEvidenceRemoved: 0 };
  let formsReclassified = 0;
  for (const page of record.pages) {
    for (const form of page.forms || []) {
      if (form.kind === "checkout" && !isStrongCheckoutForm(form)) {
        form.kind = hasContactField(form) ? "commercial" : "unknown";
        formsReclassified += 1;
      }
      form.isConversion = ["commercial", "booking", "checkout", "listing"].includes(form.kind);
      form.isLeadCapture = ["commercial", "booking", "checkout", "listing", "newsletter"].includes(form.kind);
    }
  }
  const withPage = (predicate) => record.pages.flatMap((page) => (page.forms || []).filter(predicate).map((form) => ({ pageUrl: page.url, ...form })));
  conversion.forms = withPage((form) => form.isConversion);
  conversion.leadCaptureForms = withPage((form) => form.isLeadCapture);
  conversion.auxiliaryForms = withPage((form) => !form.isConversion);
  const purchaseText = /^(?:buy now|purchase now|checkout|pay now|add to cart|comprar ahora|pagar ahora|finalizar compra|proceder al pago|acheter maintenant|jetzt kaufen)(?:\b|\s|$)/i;
  const checkoutRows = uniqueObjects(record.pages.flatMap((page) => [
    ...(page.ctas || []).filter((cta) => {
      let route = false;
      try { route = Boolean(cta.href && /\/(?:checkout|cart|payment|pay-now|buy-now)(?:[/?#]|$)/i.test(new URL(cta.href).pathname)); } catch { route = false; }
      return route || purchaseText.test(cta.text || "");
    }).map((cta) => ({ pageUrl: page.url, text: cta.text, url: cta.href, type: "cta" })),
    ...(page.forms || []).filter((form) => form.kind === "checkout" && isStrongCheckoutForm(form)).map((form) => ({ pageUrl: page.url, text: form.submitText || "Formulario de pago", url: form.action, type: "form" })),
  ]));
  const checkoutEvidenceRemoved = Math.max(0, (conversion.checkoutEvidence || []).length - checkoutRows.length);
  conversion.checkoutEvidence = checkoutRows;
  conversion.checkoutObserved = checkoutRows.length > 0;
  const captureStage = (record.commercialForensics.funnel || []).find((stage) => stage.stage === "Captura / cualificación");
  if (captureStage) {
    captureStage.status = conversion.forms.length ? "observado" : "no observable";
    captureStage.evidence = conversion.forms.slice(0, 4).map((form) => `${form.pageUrl} · ${form.visibleFieldCount} campos`);
    captureStage.note = "No se envió ningún formulario.";
  }
  const closingStage = (record.commercialForensics.funnel || []).find((stage) => stage.stage === "Propuesta / cierre");
  if (closingStage) {
    closingStage.status = checkoutRows.length ? "observado" : "no observable";
    closingStage.evidence = checkoutRows.length ? ["Checkout o compra directa visible."] : [];
    closingStage.note = checkoutRows.length ? null : "No se puede confirmar sin interactuar o contactar.";
  }
  const formDimension = (record.commercialForensics.coverage?.dimensions || []).find((dimension) => dimension.name === "Formulario");
  if (formDimension) {
    formDimension.status = conversion.forms.length ? "observado" : "no observable";
    formDimension.evidence = conversion.forms.map((form) => form.pageUrl);
    formDimension.explanation = conversion.forms.length ? null : explanations.Formulario;
  }
  return { formsReclassified, checkoutEvidenceRemoved };
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

const queue = JSON.parse(await readFile(QUEUE_FILE, "utf8"));
let recordsChanged = 0;
let explanationsAdded = 0;
let markdownLinksNormalized = 0;
let checkoutFormsReclassified = 0;
let checkoutEvidenceRemoved = 0;

for (const item of queue.items) {
  if (!item.recordFile) continue;
  const path = `research/deep/${item.recordFile}`;
  const originalText = await readFile(path, "utf8");
  let record = JSON.parse(originalText);
  const conversionNormalization = normalizeConversionEvidence(record);
  checkoutFormsReclassified += conversionNormalization.formsReclassified;
  checkoutEvidenceRemoved += conversionNormalization.checkoutEvidenceRemoved;
  for (const dimension of record.commercialForensics?.coverage?.dimensions || []) {
    if (dimension.status !== "no observable" || dimension.explanation) continue;
    dimension.explanation = explanations[dimension.name]
      || `${dimension.name}: no se localizó evidencia pública suficiente en las páginas recuperadas; la ausencia queda documentada y no se interpreta como inexistencia.`;
    explanationsAdded += 1;
  }
  record = sanitizeMarkdownLinks(record);
  if (record.id === "3c0f1447360c81d4ac71c1f0c1ab9ca1") record.name = "Dalil Iraq";
  const nextText = `${JSON.stringify(record, null, 2)}\n`;
  if (nextText !== originalText) {
    markdownLinksNormalized += (originalText.match(/]\(https?:\/\//g) || []).length;
    await writeJsonAtomic(path, record);
    recordsChanged += 1;
  }
}

const dalil = queue.items.find((item) => item.id === "3c0f1447360c81d4ac71c1f0c1ab9ca1");
if (dalil) dalil.name = "Dalil Iraq";
queue.updatedAt = new Date().toISOString();
await writeJsonAtomic(QUEUE_FILE, queue);

console.log(JSON.stringify({ recordsChanged, explanationsAdded, markdownLinksNormalized, checkoutFormsReclassified, checkoutEvidenceRemoved }, null, 2));
