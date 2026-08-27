import type {
  LandingArchitecture,
  LandingBrief,
  LandingObjective,
  LandingSectionId,
} from "./model";

export type AutomotiveRenderPlaybook = {
  label: string;
  route: string;
  eventName: string;
  accepted: string[];
  rejected: string[];
  formFields: string[];
  steps: Array<{ title: string; text: string }>;
  faqs: Array<{ question: string; answer: string }>;
};

export type LandingRenderContext = {
  headline: string;
  subheadline: string;
  cta: string;
  publishable: boolean;
  automotive: AutomotiveRenderPlaybook | null;
};

const clean = (value: unknown) =>
  typeof value === "string" || typeof value === "number"
    ? String(value).replace(/\s+/g, " ").trim()
    : "";

const esc = (value: unknown) =>
  clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const jsLiteral = (value: unknown) => JSON.stringify(clean(value)).replace(/</g, "\\u003c");

const safeUrl = (value: unknown) => {
  const text = clean(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

const safeEndpoint = (value: unknown) => {
  const text = clean(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

const safeGtmId = (value: unknown) =>
  /^GTM-[A-Z0-9]{4,}$/i.test(clean(value)) ? clean(value).toUpperCase() : "";

const safeColor = (value: unknown) =>
  /^#[0-9a-f]{6}$/i.test(clean(value)) ? clean(value) : "#1457d9";

const slugify = (value: unknown) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "landing";

const singular = (value: unknown) => {
  const text = clean(value);
  if (/iones$/i.test(text)) return text.replace(/iones$/i, "ión");
  if (/udes$/i.test(text)) return text.replace(/udes$/i, "ud");
  if (/ces$/i.test(text)) return text.replace(/ces$/i, "z");
  return text.replace(/s$/i, "") || text;
};

const css = [
  ":root{--accent-soft:#eef4ff;--ink:#111827;--muted:#596579;--line:#d9e0e9;--paper:#f5f7fa;--white:#fff;--ok:#087f5b;--danger:#b42318;--dark:#132238;--shadow:0 18px 48px rgba(15,35,64,.12)}",
  "*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:#fff;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;line-height:1.55;text-rendering:optimizeLegibility}a{color:inherit}.wrap{width:min(1160px,calc(100% - 40px));margin:auto}",
  ".topbar{position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(217,224,233,.92);background:rgba(255,255,255,.96);backdrop-filter:blur(12px)}.topbar .wrap{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:11px;text-decoration:none;font-weight:850}.brand-logo{display:block;width:auto;max-width:172px;height:38px;object-fit:contain}.brand-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:7px;background:var(--accent);color:#fff;font-size:13px;font-weight:900;letter-spacing:.04em}.topbar nav{display:flex;align-items:center;gap:24px}.topbar nav>a:not(.button){color:var(--muted);text-decoration:none;font-size:14px;font-weight:650}",
  ".button{display:inline-flex;min-height:48px;align-items:center;justify-content:center;border:1px solid var(--accent);border-radius:7px;padding:0 21px;background:var(--accent);color:#fff;text-decoration:none;font:inherit;font-weight:800;cursor:pointer;transition:transform .16s ease,background .16s ease}.button:hover{transform:translateY(-1px)}.button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 30%,transparent);outline-offset:2px}.button.secondary{border-color:var(--line);background:#fff;color:var(--ink)}",
  ".hero{border-bottom:1px solid var(--line);background:var(--paper);padding:58px 0 54px}.hero-grid{display:grid;grid-template-columns:minmax(0,1.06fr) minmax(390px,.78fr);gap:54px;align-items:start}.hero-copy{padding-top:26px}.eyebrow{margin:0 0 13px;color:var(--accent);font-size:11px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.hero h1{max-width:17ch;margin:0;font-size:clamp(42px,5.6vw,68px);line-height:1.01;letter-spacing:-.047em}.hero .lead{max-width:650px;margin:22px 0 0;color:var(--muted);font-size:19px;line-height:1.55}.hero-actions{display:flex;flex-wrap:wrap;gap:11px;margin-top:28px}.proof-pills{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 0;padding:0;list-style:none}.proof-pills li{border:1px solid #cdd8e8;border-radius:999px;background:#fff;padding:7px 11px;color:#3f4c60;font-size:12px;font-weight:720}.hero-media{margin:28px 0 0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}.hero-media img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}.process-trust{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:30px;border:1px solid var(--line);border-radius:8px;background:#fff}.process-trust div{padding:14px 15px;border-right:1px solid var(--line)}.process-trust div:last-child{border-right:0}.process-trust b{display:block;font-size:13px}.process-trust span{display:block;margin-top:3px;color:var(--muted);font-size:11px}",
  ".lead-form{border:1px solid #cad4e2;border-top:4px solid var(--accent);border-radius:8px;background:#fff;padding:28px;box-shadow:var(--shadow)}.form-head{margin-bottom:20px}.form-head span{color:var(--accent);font-size:11px;font-weight:900;letter-spacing:.13em}.form-head h2{margin:7px 0 8px;font-size:27px;line-height:1.14;letter-spacing:-.025em}.form-head p{margin:0;color:var(--muted);font-size:14px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.fields label{display:grid;gap:6px;color:#263449;font-size:12px;font-weight:760}.fields .wide{grid-column:1/-1}.fields input,.fields select,.fields textarea{width:100%;min-height:46px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;padding:11px 12px;color:var(--ink);font:inherit;font-size:15px}.fields textarea{min-height:94px;resize:vertical}.consent{display:flex!important;grid-column:1/-1;align-items:flex-start;gap:9px!important;color:var(--muted)!important;font-size:11px!important;font-weight:550!important;line-height:1.45}.consent input{width:17px;min-height:auto;margin:2px 0 0;padding:0}.lead-form .button{width:100%;margin-top:17px}.lead-form button[disabled]{cursor:wait;opacity:.65}.form-note{margin:10px 0 0;color:var(--muted);font-size:11px}.form-status{min-height:22px;margin:11px 0 0;font-size:13px;font-weight:700}.form-status[data-state=error]{color:var(--danger)}.form-status[data-state=success]{color:var(--ok)}",
  ".section{padding:76px 0}.section-head{max-width:720px}.section h2{margin:0;font-size:clamp(31px,4vw,48px);line-height:1.07;letter-spacing:-.038em}.section p{color:var(--muted);font-size:17px}.split{display:grid;grid-template-columns:minmax(0,.84fr) minmax(0,1.16fr);gap:70px;align-items:start}.problem{background:#fff}.problem-copy{border-left:3px solid var(--accent);padding-left:24px}.architecture-block,.mechanism,.pricing{background:var(--paper)}.architecture-block{border-bottom:1px solid var(--line);padding:48px 0}.architecture-block h2{font-size:clamp(27px,3vw,38px)}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:34px}.steps article,.offer-grid article{border:1px solid var(--line);border-radius:8px;background:#fff;padding:22px}.steps i{display:grid;place-items:center;width:34px;height:34px;border-radius:6px;background:var(--accent-soft);color:var(--accent);font-style:normal;font-weight:900}.steps h3,.offer-grid h3{margin:16px 0 7px;font-size:17px}.steps p,.offer-grid p{margin:0;font-size:14px}.qualification{background:var(--dark);color:#fff}.qualification .eyebrow{color:#9dc0ff}.qualification p{color:#c7d2e2}.fit-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}.fit-box{border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:22px}.fit-box b{display:block;margin-bottom:13px}.check-list,.cross-list{display:grid;gap:10px;margin:0;padding:0;list-style:none}.check-list li,.cross-list li{position:relative;padding-left:25px;color:#d8e1ed;font-size:14px}.check-list li:before{content:'✓';position:absolute;left:0;color:#64d9aa;font-weight:900}.cross-list li:before{content:'–';position:absolute;left:2px;color:#f6a7a0;font-weight:900}",
  ".offer-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:34px}.offer-grid b{color:var(--accent);font-size:12px;letter-spacing:.08em}.proof{background:var(--accent-soft)}.proof blockquote{max-width:920px;margin:15px 0 0;font-size:clamp(24px,3.5vw,39px);line-height:1.23;font-weight:760;letter-spacing:-.026em}.price-card{border:1px solid var(--line);border-radius:8px;background:#fff;padding:26px;box-shadow:var(--shadow)}.price-card span{color:var(--accent);font-size:11px;font-weight:900;letter-spacing:.12em}.price-card strong{display:block;margin:8px 0;font-size:35px}.price-card small{display:block;margin-bottom:19px;color:var(--muted)}.guarantee{background:var(--dark);color:#fff}.guarantee p{color:#d7e0ec}.faq details{border-top:1px solid var(--line);padding:19px 0}.faq details:last-child{border-bottom:1px solid var(--line)}.faq summary{cursor:pointer;font-size:17px;font-weight:820}.faq details p{max-width:780px;margin-bottom:2px;font-size:15px}.final-cta{border-top:1px solid var(--line);background:var(--paper);text-align:center}.final-cta h2{max-width:780px;margin:0 auto}.final-cta p{max-width:650px;margin:17px auto 25px}",
  ".site-footer{padding:30px 0;border-top:1px solid var(--line);color:var(--muted);font-size:12px}.footer-grid{display:flex;justify-content:space-between;gap:24px}.footer-grid nav{display:flex;flex-wrap:wrap;align-items:center;gap:15px}.analytics-manage{border:0;background:transparent;padding:0;color:inherit;font:inherit;font-weight:750;text-decoration:underline;cursor:pointer}.mobile-cta{display:none}",
  ".analytics-consent{position:fixed;right:18px;bottom:18px;z-index:40;width:min(510px,calc(100% - 36px));border:1px solid var(--line);border-top:4px solid var(--accent);background:#fff;padding:22px;box-shadow:0 24px 70px rgba(15,35,64,.25)}.analytics-consent[hidden]{display:none}.analytics-consent b{display:block;font-size:17px}.analytics-consent p{margin:7px 0 15px;color:var(--muted);font-size:13px}.analytics-consent a{font-weight:750}.consent-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}.consent-actions button{min-height:42px}.consent-actions .secondary{border-color:var(--line);background:#fff;color:var(--ink)}",
  ".theme-direct .hero{background:#0d1b2d;color:#fff}.theme-direct .hero .lead{color:#c3cfdd}.theme-direct .hero .eyebrow{color:#9fc0ff}.theme-direct .hero h1{max-width:15ch;letter-spacing:-.055em}.theme-direct .hero-grid{grid-template-columns:minmax(0,1.18fr) minmax(390px,.72fr)}.theme-direct .proof-pills li,.theme-direct .process-trust{border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff}.theme-direct .process-trust div{border-color:rgba(255,255,255,.16)}.theme-direct .process-trust span{color:#b9c6d6}.theme-direct .hero .button.secondary{border-color:rgba(255,255,255,.35);background:transparent;color:#fff}.theme-direct .lead-form{border:0;border-top:5px solid var(--accent);border-radius:3px;box-shadow:0 24px 70px rgba(0,0,0,.3)}.theme-direct .steps article,.theme-direct .offer-grid article,.theme-direct .fit-box{border-radius:3px}",
  ".theme-premium{background:#fbf8f2}.theme-premium .topbar{background:rgba(251,248,242,.96)}.theme-premium .hero{background:#f1ece3}.theme-premium .hero h1,.theme-premium .section h2,.theme-premium .form-head h2,.theme-premium .final-cta h2,.theme-premium blockquote{font-family:Georgia,\"Times New Roman\",serif;font-weight:600;letter-spacing:-.035em}.theme-premium .hero h1{max-width:18ch}.theme-premium .button,.theme-premium .brand-mark,.theme-premium .lead-form,.theme-premium .fields input,.theme-premium .fields select,.theme-premium .fields textarea,.theme-premium .steps article,.theme-premium .offer-grid article,.theme-premium .fit-box,.theme-premium .price-card{border-radius:0}.theme-premium .lead-form{border:1px solid #cfc5b5;border-top:1px solid #cfc5b5;box-shadow:0 20px 55px rgba(63,52,38,.13)}.theme-premium .qualification,.theme-premium .guarantee{background:#292722}.theme-premium .architecture-block,.theme-premium .mechanism,.theme-premium .pricing,.theme-premium .final-cta{background:#f1ece3}.theme-premium .proof{background:#e8dfd0}",
  "@media(max-width:900px){.hero-grid,.split{grid-template-columns:1fr;gap:35px}.hero-copy{padding-top:4px}.hero h1{font-size:48px}.lead-form{max-width:680px}.steps{grid-template-columns:1fr 1fr}.fit-columns{grid-template-columns:1fr}.section{padding:62px 0}}",
  "@media(max-width:620px){.wrap{width:min(100% - 28px,1160px)}.topbar .wrap{min-height:60px}.topbar nav>a:not(.button){display:none}.topbar nav .button{display:none}.hero{padding:36px 0 45px}.hero h1{font-size:38px;line-height:1.04}.hero .lead{font-size:17px}.hero-actions{display:grid}.hero-actions .button{width:100%}.process-trust{grid-template-columns:1fr}.process-trust div{border-right:0;border-bottom:1px solid var(--line)}.process-trust div:last-child{border-bottom:0}.fields{grid-template-columns:1fr}.fields .wide{grid-column:auto}.lead-form{padding:21px}.steps,.offer-grid{grid-template-columns:1fr}.section h2{font-size:32px}.footer-grid{display:grid}.mobile-cta{position:fixed;right:12px;bottom:12px;left:12px;z-index:25;display:flex;box-shadow:0 12px 30px rgba(15,35,64,.24)}body{padding-bottom:72px}}",
  "@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.button{transition:none}}",
].join("");

const fieldDefinitions = (service: string, zone: string): Record<string, string> => ({
  name: "<label>Nombre<input id=\"name\" name=\"name\" autocomplete=\"name\" required></label>",
  phone: "<label>Teléfono<input id=\"phone\" name=\"phone\" type=\"tel\" inputmode=\"tel\" autocomplete=\"tel\" minlength=\"7\" required></label>",
  email: "<label>Email<input id=\"email\" name=\"email\" type=\"email\" autocomplete=\"email\"></label>",
  company: "<label>Empresa<input id=\"company\" name=\"company\" autocomplete=\"organization\"></label>",
  service: "<label>Servicio prioritario<input id=\"service\" name=\"service\" value=\"" + service + "\"></label>",
  zone: "<label>Provincia o zona<input id=\"zone\" name=\"zone\" value=\"" + zone + "\" autocomplete=\"address-level2\" required></label>",
  availability: "<label>Disponibilidad<input id=\"availability\" name=\"availability\" placeholder=\"Día o franja preferida\"></label>",
  budget: "<label>Presupuesto orientativo<input id=\"budget\" name=\"budget\" placeholder=\"Rango previsto\"></label>",
  timeframe: "<label>Plazo de decisión<input id=\"timeframe\" name=\"timeframe\" placeholder=\"Ahora, 30 días, este trimestre…\"></label>",
  context: "<label class=\"wide\">Contexto útil<textarea id=\"context\" name=\"context\" placeholder=\"Situación actual y qué necesitas resolver\"></textarea></label>",
  vehicle: "<label>Marca y modelo<input id=\"vehicle\" name=\"vehicle\" autocomplete=\"off\" required></label>",
  year: "<label>Año<input id=\"year\" name=\"year\" inputmode=\"numeric\" pattern=\"[0-9]{4}\" required></label>",
  mileage: "<label>Kilómetros<input id=\"mileage\" name=\"mileage\" inputmode=\"numeric\" required></label>",
  debt: "<label>Deuda pendiente aproximada<input id=\"debt\" name=\"debt\" inputmode=\"decimal\" placeholder=\"Si la conoces\"></label>",
  financeCompany: "<label>Financiera<input id=\"finance_company\" name=\"finance_company\" placeholder=\"Si la conoces\"></label>",
  embargoType: "<label>Tipo de embargo<select id=\"embargo_type\" name=\"embargo_type\" required><option value=\"\">Selecciona</option><option>Hacienda / AEAT</option><option>Seguridad Social</option><option>Judicial</option><option>Otro</option><option>No lo sé</option></select></label>",
  amount: "<label>Importe aproximado<input id=\"amount\" name=\"amount\" inputmode=\"decimal\" placeholder=\"Si lo conoces\"></label>",
  ownership: "<label>Titularidad<select id=\"ownership\" name=\"ownership\" required><option value=\"\">Selecciona</option><option>Soy titular</option><option>Empresa titular</option><option>Herencia o cotitularidad</option><option>Otra situación</option></select></label>",
  chargeType: "<label>Qué carga tiene<select id=\"charge_type\" name=\"charge_type\" required><option value=\"\">Selecciona</option><option>Reserva de dominio</option><option>Embargo o precinto</option><option>Financiación pendiente</option><option>Varias cargas</option><option>No lo sé</option></select></label>",
});

const genericFormPlans: Record<LandingObjective, string[]> = {
  contact: ["name", "phone", "context", "zone", "company", "email", "service", "timeframe"],
  booking: ["name", "phone", "availability", "service", "zone", "context", "email", "company"],
  quote: ["name", "phone", "service", "zone", "budget", "context", "company", "email"],
  qualified: ["name", "phone", "company", "service", "zone", "context", "budget", "timeframe"],
};

const listItems = (items: string[], className: string) =>
  "<ul class=\"" + className + "\">" + items.map((item) => "<li>" + esc(item) + "</li>").join("") + "</ul>";

export const buildLandingHtmlV3 = (
  brief: LandingBrief,
  context: LandingRenderContext,
) => {
  const rawService = clean(brief.service || "captación de oportunidades");
  const rawDestination = clean(brief.destination);
  const brand = esc(brief.brand || "Tu marca");
  const zone = esc(brief.zone || "tu zona");
  const service = esc(rawService);
  const audience = esc(brief.audience || "personas o negocios con una necesidad concreta");
  const unit = esc(brief.unit || "oportunidades");
  const pain = esc(brief.pain || "una decisión difícil de tomar sin información suficiente");
  const result = esc(brief.result || "una respuesta clara y un siguiente paso útil");
  const offer = esc(brief.offer || "Revisión inicial, explicación del proceso y siguiente paso.");
  const proof = esc(brief.proof);
  const price = esc(brief.price);
  const guarantee = esc(brief.guarantee);
  const headline = esc(context.headline);
  const subheadline = esc(context.subheadline);
  const cta = esc(context.cta);
  const accent = safeColor(brief.accent);
  const visualTheme = ["consultative", "direct", "premium"].includes(brief.tone)
    ? brief.tone
    : "consultative";
  const architectureClass = ["local", "diagnostic", "booking", "saas", "marketplace", "pricing"].includes(brief.architecture)
    ? brief.architecture
    : "local";
  const logoUrl = safeUrl(brief.logoUrl);
  const heroImageUrl = safeUrl(brief.heroImageUrl);
  const privacyUrl = safeUrl(brief.privacyUrl);
  const cookiesUrl = safeUrl(brief.cookiesUrl);
  const endpoint = safeEndpoint(brief.leadEndpoint);
  const gtmId = safeGtmId(brief.gtmId);
  const legalName = esc(brief.legalName);
  const legalId = esc(brief.legalId);
  const calendarUrl =
    brief.ctaMode === "calendar" && /^https?:\/\//i.test(rawDestination)
      ? safeUrl(rawDestination)
      : "";
  const phone =
    brief.ctaMode !== "calendar" && !/^https?:/i.test(rawDestination)
      ? rawDestination.replace(/\D/g, "")
      : "";
  const validPhone = phone.length >= 7 && phone.length <= 15 ? phone : "";
  const route = context.automotive
    ? context.automotive.route
    : "/" + slugify(brief.service) + "-" + slugify(brief.zone) + "/";
  const intentCluster = context.automotive
    ? brief.intent.replace(/-/g, "_")
    : brief.verticalId.replace(/-/g, "_");
  const eventName = context.automotive
    ? context.automotive.eventName
    : "lead_form_submit_" + brief.verticalId.replace(/-/g, "_");
  const metaDescription = esc(
    (clean(brief.result) + " en " + clean(brief.zone || "tu zona") + ". " + clean(brief.offer)).slice(0, 155),
  );
  const endpointOrigin = endpoint ? new URL(endpoint).origin : "";
  const imageOrigin = heroImageUrl ? new URL(heroImageUrl).origin : "";
  const logoOrigin = logoUrl ? new URL(logoUrl).origin : "";
  const cspOrigins = [...new Set([endpointOrigin, imageOrigin, logoOrigin].filter(Boolean))].join(" ");
  const robots = context.publishable ? "index,follow" : "noindex,nofollow";

  const logo = logoUrl
    ? "<img src=\"" + esc(logoUrl) + "\" alt=\"" + brand + "\" class=\"brand-logo\" width=\"172\" height=\"38\">"
    : "<span class=\"brand-mark\">" + brand.slice(0, 2).toUpperCase() + "</span><b>" + brand + "</b>";

  const media = heroImageUrl
    ? "<figure class=\"hero-media\"><img src=\"" + esc(heroImageUrl) + "\" alt=\"" + service + " en " + zone + "\" width=\"960\" height=\"540\" fetchpriority=\"high\" decoding=\"async\"></figure>"
    : "<div class=\"process-trust\" aria-label=\"Cómo abordamos cada solicitud\"><div><b>Primero revisamos</b><span>No prometemos antes de comprobar.</span></div><div><b>Después explicamos</b><span>Sabrás qué encaja y qué no.</span></div><div><b>Tú decides</b><span>Ningún paso queda aceptado por enviar datos.</span></div></div>";

  const definitions = fieldDefinitions(service, zone);
  const requestedPlan = context.automotive
    ? context.automotive.formFields
    : genericFormPlans[brief.objective];
  const formFieldsTarget = Math.max(3, Math.min(8, Math.round(brief.formFieldsTarget || 5)));
  const fieldPlan = context.automotive
    ? requestedPlan
    : requestedPlan.slice(0, formFieldsTarget);
  const fields = fieldPlan.map((field) => definitions[field]).filter(Boolean).join("");
  const privacy = privacyUrl
    ? "He leído la <a href=\"" + esc(privacyUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">política de privacidad</a> y acepto que " + brand + " contacte conmigo."
    : "Acepto que " + brand + " contacte conmigo para responder a esta solicitud.";
  const formAction = endpoint ? esc(endpoint) : "#";
  const trustPills = listItems(
    ["Revisión antes de prometer", "Proceso explicado", ...(privacyUrl ? ["Privacidad y responsable visibles"] : [])],
    "proof-pills",
  );

  const genericAccepted = [
    "Necesidad relacionada con " + rawService,
    "Zona dentro de la cobertura indicada",
    "Datos suficientes para valorar el encaje",
    "Capacidad o intención real para avanzar",
  ];
  const genericRejected = [
    "Consultas ajenas al servicio descrito",
    "Solicitudes sin datos para responder",
    "Casos fuera de la cobertura",
  ];
  const accepted = context.automotive ? context.automotive.accepted : genericAccepted;
  const rejected = context.automotive ? context.automotive.rejected : genericRejected;
  const genericSteps = [
    { title: "Cuéntanos el contexto", text: "Recogemos " + clean(brief.filter) + "." },
    { title: "Revisamos el encaje", text: "Comprobamos alcance, zona y viabilidad antes de confirmar nada." },
    { title: "Recibes una respuesta", text: "Te explicamos el siguiente paso y las condiciones que aplican." },
    { title: "Decides si avanzar", text: "Solo se formaliza lo que ambas partes hayan revisado y aceptado." },
  ];
  const steps = context.automotive ? context.automotive.steps : genericSteps;
  const genericFaqs = [
    {
      question: "¿Qué cuenta como " + singular(brief.unit) + " con encaje?",
      answer: "Se revisa usando " + clean(brief.filter) + ". También se aclara cómo se tratan datos incorrectos, duplicados o casos fuera de zona.",
    },
    {
      question: "¿Qué ocurre después de enviar el formulario?",
      answer: "El equipo revisa la información y responde con el siguiente paso. El envío por sí solo no confirma precio, disponibilidad ni resultado.",
    },
    {
      question: "¿Hay exclusividad territorial?",
      answer: "Si existe, su zona, alcance y duración se detallarán de forma expresa en las condiciones antes de contratar.",
    },
    {
      question: "¿Existe permanencia o renovación automática?",
      answer: "Duración, renovación y cancelación deben aparecer en la propuesta o contrato antes de cualquier pago.",
    },
  ];
  const faqs = context.automotive ? context.automotive.faqs : genericFaqs;

  const problemSection =
    "<section class=\"section problem\"><div class=\"wrap split\"><div><p class=\"eyebrow\">LA SITUACIÓN REAL</p><h2>Una decisión difícil necesita contexto, no una promesa rápida</h2></div><div class=\"problem-copy\"><p>El problema no es solo " + pain + ".</p><p>Esta página busca que puedas conseguir <strong>" + result + "</strong> con un proceso que explique qué se revisa antes de avanzar.</p></div></div></section>";
  const qualificationSection =
    "<section class=\"section qualification\"><div class=\"wrap split\"><div><p class=\"eyebrow\">ENCAJE</p><h2>Comprueba si esta es la ruta correcta para tu caso</h2><p>Está pensada para " + audience + ".</p></div><div class=\"fit-columns\"><div class=\"fit-box\"><b>Sí revisamos</b>" + listItems(accepted, "check-list") + "</div><div class=\"fit-box\"><b>No es esta ruta</b>" + listItems(rejected, "cross-list") + "</div></div></div></section>";
  const mechanismSection =
    "<section class=\"section mechanism\" id=\"proceso\"><div class=\"wrap\"><div class=\"section-head\"><p class=\"eyebrow\">PROCESO</p><h2>Un recorrido visible de principio a fin</h2><p>Cada paso tiene una función y evita pedir documentación antes de saber si merece la pena.</p></div><div class=\"steps\">" +
    steps
      .map(
        (step, index) =>
          "<article><i>" + String(index + 1).padStart(2, "0") + "</i><h3>" + esc(step.title) + "</h3><p>" + esc(step.text) + "</p></article>",
      )
      .join("") +
    "</div></div></section>";
  const offerSection =
    "<section class=\"section offer\"><div class=\"wrap\"><div class=\"section-head\"><p class=\"eyebrow\">QUÉ RECIBES</p><h2>Una propuesta que deja claro el alcance</h2><p>" + offer + "</p></div><div class=\"offer-grid\"><article><b>01 · REVISIÓN</b><h3>Contexto antes de precio</h3><p>Se comprueban los datos necesarios para evitar respuestas genéricas.</p></article><article><b>02 · CRITERIO</b><h3>Encaje explicado</h3><p>Sabes por qué el caso puede avanzar o por qué no.</p></article><article><b>03 · CONDICIONES</b><h3>Responsabilidades visibles</h3><p>Quién hace cada trámite y qué queda pendiente se aclara antes de aceptar.</p></article><article><b>04 · SIGUIENTE PASO</b><h3>Una decisión concreta</h3><p>Avanzar, aportar un documento o detener el proceso sin perder más tiempo.</p></article></div></div></section>";
  const proofSection = proof
    ? "<section class=\"section proof\"><div class=\"wrap\"><p class=\"eyebrow\">PRUEBA IDENTIFICABLE</p><blockquote>" + proof + "</blockquote></div></section>"
    : "";
  const pricingSection = price
    ? "<section class=\"section pricing\"><div class=\"wrap split\"><div><p class=\"eyebrow\">PRECIO Y CONDICIONES</p><h2>La inversión aparece antes de pedir una decisión</h2><p>" + offer + "</p></div><article class=\"price-card\"><span>INVERSIÓN PUBLICADA</span><strong>" + price + "</strong><small>Revisa impuestos, duración, renovación, cancelación y exclusiones en las condiciones.</small><a class=\"button\" href=\"#lead-form\">" + cta + "</a></article></div></section>"
    : "";
  const guaranteeSection = guarantee
    ? "<section class=\"section guarantee\"><div class=\"wrap split\"><div><p class=\"eyebrow\">COMPROMISO PUBLICABLE</p><h2>Qué se promete y bajo qué condiciones</h2></div><p>" + guarantee + "</p></div></section>"
    : "";
  const faqSection =
    "<section class=\"section faq\" id=\"faq\"><div class=\"wrap\"><div class=\"section-head\"><p class=\"eyebrow\">PREGUNTAS CLAVE</p><h2>Respuestas antes de pedirte que avances</h2></div>" +
    faqs
      .slice(0, brief.depth === "short" ? 2 : brief.depth === "standard" ? 3 : 4)
      .map((faq) => "<details><summary>" + esc(faq.question) + "</summary><p>" + esc(faq.answer) + "</p></details>")
      .join("") +
    "</div></section>";

  const architectureSections: Record<LandingArchitecture, string> = {
    local:
      "<section class=\"section architecture-block local-block\"><div class=\"wrap split\"><div><p class=\"eyebrow\">COBERTURA</p><h2>Primero zona y capacidad; después volumen</h2></div><p>La propuesta se limita a " + zone + " y comprueba que existe capacidad real para atender más " + unit + ".</p></div></section>",
    diagnostic:
      "<section class=\"section architecture-block diagnostic-block\"><div class=\"wrap split\"><div><p class=\"eyebrow\">DIAGNÓSTICO</p><h2>La primera respuesta debe producir una decisión</h2></div><p>Se revisan situación, documentación disponible y viabilidad antes de recomendar un alcance o hablar de una oferta.</p></div></section>",
    booking:
      "<section class=\"section architecture-block booking-block\"><div class=\"wrap split\"><div><p class=\"eyebrow\">RESERVA</p><h2>Preparación y siguiente paso sin fricción</h2></div><p>La página explica qué ocurrirá en la cita y qué información conviene aportar para que la conversación sea útil.</p></div></section>",
    saas:
      "<section class=\"section architecture-block saas-block\"><div class=\"wrap split\"><div><p class=\"eyebrow\">PRODUCTO</p><h2>De la promesa a una demostración comprensible</h2></div><p>Capacidades, entradas, salidas, permisos y prueba del producto aparecen antes de solicitar una demo.</p></div></section>",
    marketplace:
      "<section class=\"section architecture-block marketplace-block\"><div class=\"wrap split\"><div><p class=\"eyebrow\">SOLICITUD Y MATCHING</p><h2>Una petición clara antes de presentar proveedores</h2></div><p>Se valida cobertura, necesidad y datos de contacto, y se explica con quién se compartirán.</p></div></section>",
    pricing:
      "<section class=\"section architecture-block pricing-block\"><div class=\"wrap split\"><div><p class=\"eyebrow\">ALCANCE COMPARABLE</p><h2>Precio, límites y condiciones antes del contacto</h2></div><p>La comparación deja visibles duración, inversión externa, renovación, cancelación y exclusiones.</p></div></section>",
  };

  const sectionMap: Record<LandingSectionId, string> = {
    problem: problemSection,
    qualification: qualificationSection,
    mechanism: mechanismSection,
    offer: offerSection,
    proof: proofSection,
    pricing: pricingSection,
    guarantee: guaranteeSection,
    faq: faqSection,
  };
  const fallbackCore: LandingSectionId[] = ["problem", "qualification", "mechanism", "offer"];
  const preferred = [
    ...(brief.evidencePlan?.sectionSequence || []),
    ...fallbackCore,
    "proof",
    "pricing",
    "guarantee",
    "faq",
  ] as LandingSectionId[];
  const uniquePreferred = preferred.filter(
    (id, index, values) => values.indexOf(id) === index,
  );
  const coreOrder = uniquePreferred.filter((id) => fallbackCore.includes(id));
  const depthLimit = brief.depth === "short" ? 2 : brief.depth === "standard" ? 3 : 4;
  const activeCore = new Set(coreOrder.slice(0, depthLimit));
  const renderedSections = uniquePreferred
    .filter((id) => (fallbackCore.includes(id) ? activeCore.has(id) : Boolean(sectionMap[id])))
    .map((id) => sectionMap[id])
    .join("");

  const legalLinks = [
    privacyUrl
      ? "<a href=\"" + esc(privacyUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">Privacidad</a>"
      : "",
    cookiesUrl
      ? "<a href=\"" + esc(cookiesUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">Cookies</a>"
      : "",
  ]
    .filter(Boolean)
    .join("");
  const legalIdentity = [legalName || brand, legalId].filter(Boolean).join(" · ");
  const consentManager = gtmId
    ? "<button class=\"analytics-manage\" type=\"button\" data-analytics-manage>Gestionar analítica</button>"
    : "";
  const consentBanner = gtmId
    ? "<aside class=\"analytics-consent\" hidden role=\"dialog\" aria-label=\"Preferencias de analítica\"><b>Tu privacidad, antes que la medición</b><p>La analítica y los identificadores de campaña son opcionales. Puedes rechazarlos y enviar igualmente tu solicitud.</p>" +
      (cookiesUrl ? "<a href=\"" + esc(cookiesUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">Consultar política de cookies</a>" : "") +
      "<div class=\"consent-actions\"><button class=\"button secondary\" type=\"button\" data-analytics-consent=\"denied\">Solo necesarias</button><button class=\"button\" type=\"button\" data-analytics-consent=\"granted\">Aceptar analítica</button></div></aside>"
    : "";
  const schema = legalName
    ? "<script type=\"application/ld+json\">" +
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Service",
        name: clean(brief.service),
        provider: { "@type": "Organization", name: clean(brief.legalName) },
        areaServed: clean(brief.zone),
        audience: clean(brief.audience),
      }).replace(/</g, "\\u003c") +
      "</script>"
    : "<!-- Añadir datos legales reales antes de publicar JSON-LD -->";

  const followup =
    brief.ctaMode === "whatsapp" && validPhone
      ? "var service=data.service||" +
        jsLiteral(rawService) +
        ";var message=['Hola, quiero revisar mi solicitud.',data.vehicle?'Vehículo: '+data.vehicle+'.':'',data.zone?'Zona: '+data.zone+'.':'','Servicio: '+service+'.',data.context?'Contexto: '+data.context+'.':'',utm()].filter(Boolean).join('\\n');window.location.href='https://wa.me/" +
        validPhone +
        "?text='+encodeURIComponent(message);"
      : brief.ctaMode === "calendar" && calendarUrl
        ? "window.location.assign(" + jsLiteral(calendarUrl) + ");"
        : brief.ctaMode === "phone" && validPhone
          ? "window.location.href='tel:+" + validPhone + "';"
          : "setStatus('Configura el destino del CTA antes de publicar.','error');";
  const endpointLiteral = jsLiteral(endpoint);
  const routeLiteral = jsLiteral(route);
  const intentLiteral = jsLiteral(intentCluster);
  const eventLiteral = jsLiteral(eventName);
  const gtmIdLiteral = jsLiteral(gtmId);
  const script =
    "<script>(function(){" +
    "var form=document.querySelector('.lead-form');if(!form)return;" +
    "var button=form.querySelector('button[type=submit]');var status=form.querySelector('.form-status');" +
    "var endpoint=" + endpointLiteral + ";var route=" + routeLiteral + ";var intent=" + intentLiteral + ";var gtmId=" + gtmIdLiteral + ";" +
    "var keys=['gclid','gbraid','wbraid','fbclid','msclkid','utm_source','utm_medium','utm_campaign','utm_content','utm_term'];" +
    "var storageKey='rv_attribution_v1';var consentKey='rv_analytics_consent_v1';var consentDuration=15552000000;var query=new URLSearchParams(window.location.search);var currentAttribution={};var attribution={};var analyticsAllowed=false;" +
    "keys.forEach(function(key){var value=query.get(key);if(value)currentAttribution[key]=value});" +
    "window.dataLayer=window.dataLayer||[];var gtag=function(){window.dataLayer.push(arguments)};gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});" +
    "var hydrateFields=function(){keys.forEach(function(key){var node=form.querySelector('[name=\"'+key+'\"]');if(node)node.value=attribution[key]||''})};" +
    "var loadGtm=function(){if(!gtmId||document.querySelector('script[data-rv-gtm]'))return;window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});var tag=document.createElement('script');tag.async=true;tag.dataset.rvGtm='true';tag.src='https://www.googletagmanager.com/gtm.js?id='+encodeURIComponent(gtmId);document.head.appendChild(tag)};" +
    "var banner=document.querySelector('.analytics-consent');var applyAnalyticsConsent=function(state,persist){analyticsAllowed=state==='granted'&&Boolean(gtmId);if(persist){try{localStorage.setItem(consentKey,JSON.stringify({state:state,updatedAt:Date.now(),expiresAt:Date.now()+consentDuration}))}catch(e){}}if(analyticsAllowed){try{attribution=JSON.parse(localStorage.getItem(storageKey)||'{}')||{}}catch(e){attribution={}}Object.assign(attribution,currentAttribution);try{localStorage.setItem(storageKey,JSON.stringify(attribution))}catch(e){}gtag('consent','update',{ad_storage:'denied',analytics_storage:'granted',ad_user_data:'denied',ad_personalization:'denied'});loadGtm()}else{attribution={};try{localStorage.removeItem(storageKey)}catch(e){}gtag('consent','update',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'})}hydrateFields();if(banner)banner.hidden=true};" +
    "var clearStoredConsent=function(){try{localStorage.removeItem(consentKey);localStorage.removeItem(storageKey)}catch(e){}};var readConsent=function(){try{var raw=localStorage.getItem(consentKey)||'';if(!raw)return '';if(raw==='granted'||raw==='denied'){clearStoredConsent();return ''}var stored=JSON.parse(raw);if(!stored||!['granted','denied'].includes(stored.state)||!stored.expiresAt||Date.now()>stored.expiresAt){clearStoredConsent();return ''}return stored.state}catch(e){clearStoredConsent();return ''}};var savedConsent=readConsent();if(gtmId&&(savedConsent==='granted'||savedConsent==='denied')){applyAnalyticsConsent(savedConsent,false)}else if(gtmId&&banner){banner.hidden=false}document.querySelectorAll('[data-analytics-consent]').forEach(function(control){control.addEventListener('click',function(){applyAnalyticsConsent(control.dataset.analyticsConsent||'denied',true)})});document.querySelectorAll('[data-analytics-manage]').forEach(function(control){control.addEventListener('click',function(){if(banner){banner.hidden=false;var first=banner.querySelector('button');if(first)first.focus()}})});" +
    "var utm=function(){var out=['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].map(function(k){return attribution[k]?k+': '+attribution[k]:''}).filter(Boolean);return out.length?'Origen: '+out.join(', '):''};" +
    "var setStatus=function(message,state){status.textContent=message;status.dataset.state=state||''};" +
    "document.querySelectorAll('details').forEach(function(item){item.addEventListener('toggle',function(){if(item.open&&analyticsAllowed)window.dataLayer.push({event:'faq_open',intent_cluster:intent,landing_route:route})})});" +
    "form.addEventListener('submit',async function(e){e.preventDefault();if(!form.reportValidity())return;if(!endpoint){setStatus('Esta versión es de revisión: configura un endpoint HTTPS para entregar el lead.','error');return;}button.disabled=true;setStatus('Enviando tu solicitud…','');" +
    "var data=Object.fromEntries(new FormData(form).entries());data.landing_route=route;data.intent_cluster=intent;data.attribution=attribution;data.submitted_at=new Date().toISOString();data.idempotency_key=(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2));" +
    "var controller=new AbortController();var timer=setTimeout(function(){controller.abort()},12000);" +
    "try{var response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Idempotency-Key':data.idempotency_key},body:JSON.stringify(data),signal:controller.signal});if(!response.ok)throw new Error('HTTP '+response.status);" +
    "if(analyticsAllowed){var completedFields=Object.keys(data).filter(function(key){return keys.indexOf(key)<0&&!['privacy_consent','landing_route','intent_cluster','attribution','submitted_at','idempotency_key'].includes(key)&&String(data[key]||'').trim()}).length;window.dataLayer.push({event:" + eventLiteral + ",intent_cluster:intent,landing_route:route,form_id:'lead-form',completed_field_count:completedFields,submitted_at:data.submitted_at})}" +
    "setStatus('Solicitud enviada. Continuamos con el siguiente paso.','success');setTimeout(function(){" +
    followup +
    "form.reset();},450);" +
    "}catch(error){setStatus(error&&error.name==='AbortError'?'La entrega ha tardado demasiado. Inténtalo de nuevo.':'No hemos podido entregar la solicitud. Revisa la conexión y vuelve a intentarlo.','error')}finally{clearTimeout(timer);button.disabled=false}});" +
    "})();</script>";

  const hiddenAttribution = [
    "gclid",
    "gbraid",
    "wbraid",
    "fbclid",
    "msclkid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ]
    .map((key) => "<input type=\"hidden\" name=\"" + key + "\" value=\"\">")
    .join("");
  const form =
    "<form class=\"lead-form\" id=\"lead-form\" action=\"" +
    formAction +
    "\" method=\"post\" novalidate><div class=\"form-head\"><span>REVISIÓN INICIAL</span><h2>" +
    cta +
    "</h2><p>Cuéntanos lo necesario para darte una respuesta útil.</p></div><div class=\"fields\">" +
    fields +
    hiddenAttribution +
    "<input type=\"hidden\" name=\"landing_route\" value=\"" +
    esc(route) +
    "\"><input type=\"hidden\" name=\"intent_cluster\" value=\"" +
    esc(intentCluster) +
    "\"><label class=\"consent\"><input type=\"checkbox\" name=\"privacy_consent\" value=\"accepted\" required><span>" +
    privacy +
    "</span></label></div><button class=\"button\" type=\"submit\">" +
    cta +
    "</button><p class=\"form-note\">Enviar estos datos no confirma precio, disponibilidad ni aceptación del caso.</p><p class=\"form-status\" role=\"status\" aria-live=\"polite\"></p></form><!-- Formulario de " +
    formFieldsTarget +
    " campos adaptado al objetivo «" +
    (brief.objective === "qualified"
      ? "solicitud cualificada"
      : brief.objective === "booking"
        ? "reserva"
        : brief.objective === "quote"
          ? "propuesta"
          : "contacto") +
    "». -->";

  return [
    "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
    "<title>" + brand + " · " + service + " en " + zone + "</title>",
    "<meta name=\"description\" content=\"" + metaDescription + "\"><meta name=\"robots\" content=\"" + robots + "\">",
    "<meta name=\"referrer\" content=\"strict-origin-when-cross-origin\">",
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; img-src 'self' data: https:; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; connect-src 'self' " + esc(cspOrigins) + " https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com; font-src 'self' data:; base-uri 'self'; form-action 'self' " + esc(endpointOrigin) + "; frame-ancestors 'none'\">",
    schema,
    "<style>:root{--accent:" + accent + "}" + css + "</style></head><body class=\"theme-" + visualTheme + " architecture-" + architectureClass + "\"" + (context.publishable ? "" : " data-draft=\"true\"") + ">",
    "<header class=\"topbar\"><div class=\"wrap\"><a class=\"brand\" href=\"#\">" + logo + "</a><nav><a href=\"#proceso\">Proceso</a><a href=\"#faq\">Preguntas</a><a class=\"button\" href=\"#lead-form\">" + cta + "</a></nav></div></header>",
    "<main><section class=\"hero\"><div class=\"wrap hero-grid\"><div class=\"hero-copy\"><p class=\"eyebrow\">" + service + " · " + zone + "</p><h1>" + headline + "</h1><p class=\"lead\">" + subheadline + "</p><div class=\"hero-actions\"><a class=\"button\" href=\"#lead-form\">" + cta + "</a><a class=\"button secondary\" href=\"#proceso\">Ver cómo funciona</a></div>" + trustPills + media + "</div>" + form + "</div></section>",
    architectureSections[brief.architecture],
    renderedSections,
    "<section class=\"section final-cta\"><div class=\"wrap\"><p class=\"eyebrow\">SIGUIENTE PASO</p><h2>" + result + "</h2><p>Comparte el contexto mínimo y recibe una respuesta basada en tu caso.</p><a class=\"button\" href=\"#lead-form\">" + cta + "</a></div></section></main>",
    "<footer class=\"site-footer\"><div class=\"wrap footer-grid\"><div><b>" + legalIdentity + "</b><br>" + service + " · " + zone + "</div><nav>" + legalLinks + consentManager + "</nav></div></footer>",
    "<a class=\"button mobile-cta\" href=\"#lead-form\">" + cta + "</a>",
    consentBanner,
    "<noscript><div class=\"wrap\" role=\"alert\">Necesitas JavaScript para confirmar el estado del envío. También puedes usar el formulario con su destino configurado.</div></noscript>",
    script,
    "</body></html>",
  ].join("");
};
