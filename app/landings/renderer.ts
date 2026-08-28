import type {
  LandingArchitecture,
  LandingBrief,
  LandingObjective,
  LandingSectionId,
} from "./model";
import { VERTICAL_CONTENT } from "./vertical-content.ts";

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
  ":root{--accent-soft:#eef4ff;--accent-deep:#0a3d91;--ink:#0f172a;--muted:#51607a;--line:#dbe3ee;--paper:#f6f8fc;--white:#fff;--ok:#0c7a4d;--ok-soft:#e8f7ef;--danger:#b42318;--dark:#0d1b2d;--shadow-sm:0 1px 2px rgba(15,35,64,.06),0 4px 12px rgba(15,35,64,.06);--shadow:0 2px 6px rgba(15,35,64,.07),0 18px 48px rgba(15,35,64,.14);--radius:14px}",
  "*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:#fff;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;line-height:1.6;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}a{color:inherit}.wrap{width:min(1180px,calc(100% - 44px));margin:auto}",
  ".topbar{position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(219,227,238,.9);background:rgba(255,255,255,.92);backdrop-filter:blur(14px)}.topbar .wrap{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-weight:850;font-size:17px;letter-spacing:-.02em}.brand-logo{display:block;width:auto;max-width:176px;height:40px;object-fit:contain}.brand-mark{display:grid;place-items:center;width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,var(--accent),var(--accent-deep));color:#fff;font-size:14px;font-weight:900;letter-spacing:.04em;box-shadow:0 4px 12px color-mix(in srgb,var(--accent) 35%,transparent)}.topbar nav{display:flex;align-items:center;gap:26px}.topbar nav>a:not(.button){color:var(--muted);text-decoration:none;font-size:14.5px;font-weight:650;transition:color .15s}.topbar nav>a:not(.button):hover{color:var(--ink)}",
  ".button{display:inline-flex;min-height:52px;align-items:center;justify-content:center;gap:9px;border:1px solid var(--accent);border-radius:12px;padding:0 26px;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 92%,#fff),var(--accent));color:#fff;text-decoration:none;font:inherit;font-size:15.5px;font-weight:800;letter-spacing:-.01em;cursor:pointer;box-shadow:0 1px 2px rgba(10,40,90,.18),0 8px 22px color-mix(in srgb,var(--accent) 32%,transparent);transition:transform .16s ease,box-shadow .16s ease,filter .16s ease}.button:hover{transform:translateY(-2px);filter:brightness(1.04);box-shadow:0 2px 4px rgba(10,40,90,.2),0 14px 30px color-mix(in srgb,var(--accent) 40%,transparent)}.button:active{transform:translateY(0)}.button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 32%,transparent);outline-offset:2px}.button.secondary{border-color:var(--line);background:#fff;color:var(--ink);box-shadow:var(--shadow-sm)}.button.secondary:hover{border-color:#b9c6da;box-shadow:var(--shadow)}",
  ".hero{position:relative;border-bottom:1px solid var(--line);background:radial-gradient(1200px 520px at 82% -10%,color-mix(in srgb,var(--accent) 13%,transparent),transparent 60%),radial-gradient(900px 420px at -8% 30%,color-mix(in srgb,var(--accent) 7%,transparent),transparent 55%),linear-gradient(180deg,#fbfcfe,var(--paper));padding:68px 0 64px;overflow:hidden}.hero:before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(15,35,64,.05) 1px,transparent 1px);background-size:26px 26px;mask-image:linear-gradient(180deg,#000 20%,transparent 85%);pointer-events:none}.hero .wrap{position:relative}.hero-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(400px,.8fr);gap:56px;align-items:start}.hero-copy{padding-top:16px}",
  ".brand-logo-rv{display:block;height:36px;width:auto}.footer-logo{margin-bottom:10px}.footer-logo .brand-logo-rv{height:30px}",
  ".hero-copy>*{opacity:0;transform:translateY(16px);animation:rvup .55s cubic-bezier(.2,.65,.3,1) forwards}.hero-copy>*:nth-child(1){animation-delay:.05s}.hero-copy>*:nth-child(2){animation-delay:.12s}.hero-copy>*:nth-child(3){animation-delay:.19s}.hero-copy>*:nth-child(4){animation-delay:.26s}.hero-copy>*:nth-child(5){animation-delay:.33s}.hero-copy>*:nth-child(6){animation-delay:.4s}.hero-copy>*:nth-child(7){animation-delay:.47s}.hero .lead-form{opacity:0;animation:rvup .6s cubic-bezier(.2,.65,.3,1) .3s forwards}@keyframes rvup{to{opacity:1;transform:none}}",
  ".button:not(.secondary){position:relative;overflow:hidden}.button:not(.secondary):after{content:'';position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);transition:left .5s ease}.button:not(.secondary):hover:after{left:125%}",
  ".hero-art{position:absolute;inset:0;pointer-events:none;overflow:hidden}.hero-art svg{position:absolute;right:max(30%,420px);top:8%;width:min(30vw,380px);height:auto;stroke:var(--accent);opacity:.09;fill:none;stroke-width:9;stroke-linecap:round;stroke-linejoin:round;animation:rvfloat 10s ease-in-out infinite alternate}.hero-art .orb{position:absolute;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent) 55%,transparent),transparent 70%);filter:blur(70px)}.hero-art .orb-a{left:-140px;top:-160px;width:460px;height:460px;opacity:.35}.hero-art .orb-b{right:-120px;bottom:-180px;width:400px;height:400px;opacity:.22}.hero-art .ring{position:absolute;right:-90px;top:-110px;width:340px;height:340px;border:2px dashed color-mix(in srgb,var(--accent) 35%,transparent);border-radius:50%;animation:rvspin 60s linear infinite}@keyframes rvfloat{from{transform:translateY(0) rotate(-2deg)}to{transform:translateY(-16px) rotate(2deg)}}@keyframes rvspin{to{transform:rotate(360deg)}}.theme-direct .hero-art svg{opacity:.14}.theme-direct .hero-art .orb{opacity:.28}.theme-premium .hero-art svg{opacity:.07}@media(max-width:900px){.hero-art svg{right:-60px;top:2%;width:300px}}@media(prefers-reduced-motion:reduce){.hero-art svg,.hero-art .ring{animation:none}}",
  ".zone-badge{display:inline-flex;align-items:center;gap:9px;margin:0 0 20px;border:1px solid color-mix(in srgb,var(--accent) 28%,#fff);border-radius:999px;background:#fff;padding:8px 16px;color:var(--accent-deep);font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;box-shadow:var(--shadow-sm)}.zone-badge i{position:relative;width:8px;height:8px;border-radius:50%;background:var(--ok);font-style:normal}.zone-badge i:after{content:'';position:absolute;inset:-4px;border-radius:50%;border:2px solid color-mix(in srgb,var(--ok) 45%,transparent);animation:rvpulse 1.8s ease-out infinite}@keyframes rvpulse{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.5);opacity:0}}",
  ".eyebrow{margin:0 0 14px;color:var(--accent);font-size:11.5px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.hero h1{max-width:16ch;margin:0;font-size:clamp(42px,5.4vw,66px);line-height:1.03;letter-spacing:-.045em;font-weight:850}.hero .lead{max-width:620px;margin:24px 0 0;color:var(--muted);font-size:19.5px;line-height:1.6}.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}.proof-pills{display:flex;flex-wrap:wrap;gap:9px;margin:26px 0 0;padding:0;list-style:none}.proof-pills li{display:inline-flex;align-items:center;gap:7px;border:1px solid #cdd9e8;border-radius:999px;background:rgba(255,255,255,.85);padding:8px 14px;color:#33415c;font-size:13px;font-weight:700}.proof-pills li:before{content:'';width:15px;height:15px;flex:none;background:var(--ok);mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'/%3E%3C/svg%3E\") center/contain no-repeat}",
  ".hero-media{margin:30px 0 0;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:#fff;box-shadow:var(--shadow-sm)}.hero-media img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}.process-trust{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:34px;border:1px solid var(--line);border-radius:var(--radius);background:#fff;box-shadow:var(--shadow-sm);overflow:hidden}.process-trust div{position:relative;padding:18px 18px 18px 52px;border-right:1px solid var(--line)}.process-trust div:last-child{border-right:0}.process-trust div:before{content:'';position:absolute;left:17px;top:20px;width:22px;height:22px;border-radius:7px;background:var(--accent-soft)}.process-trust div:after{content:'';position:absolute;left:22px;top:25px;width:12px;height:12px;background:var(--accent);mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'/%3E%3C/svg%3E\") center/contain no-repeat}.process-trust b{display:block;font-size:14px;letter-spacing:-.01em}.process-trust span{display:block;margin-top:3px;color:var(--muted);font-size:12px;line-height:1.45}",
  ".lead-form{position:relative;border:1px solid #ccd7e6;border-radius:var(--radius);background:#fff;padding:30px;box-shadow:var(--shadow)}.lead-form:before{content:'';position:absolute;top:0;left:0;right:0;height:5px;border-radius:var(--radius) var(--radius) 0 0;background:linear-gradient(90deg,var(--accent),var(--accent-deep))}.form-head{margin-bottom:22px}.form-head span{display:inline-block;border-radius:6px;background:var(--accent-soft);padding:5px 10px;color:var(--accent-deep);font-size:11px;font-weight:900;letter-spacing:.12em}.form-head h2{margin:12px 0 8px;font-size:26px;line-height:1.16;letter-spacing:-.028em}.form-head p{margin:0;color:var(--muted);font-size:14.5px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.fields label{display:grid;gap:6px;color:#26344b;font-size:12.5px;font-weight:750}.fields .wide{grid-column:1/-1}.fields input,.fields select,.fields textarea{width:100%;min-height:48px;border:1px solid #c6d2e2;border-radius:9px;background:#fbfcfe;padding:12px 13px;color:var(--ink);font:inherit;font-size:15px;transition:border-color .15s,background .15s}.fields input:hover,.fields select:hover,.fields textarea:hover{border-color:#a8bad2}.fields input:focus,.fields select:focus,.fields textarea:focus{background:#fff;border-color:var(--accent)}.fields textarea{min-height:96px;resize:vertical}.consent{display:flex!important;grid-column:1/-1;align-items:flex-start;gap:10px!important;color:var(--muted)!important;font-size:11.5px!important;font-weight:550!important;line-height:1.5}.consent input{width:17px;min-height:auto;margin:2px 0 0;padding:0}.lead-form .button{width:100%;margin-top:18px;min-height:56px;font-size:16.5px}.lead-form button[disabled]{cursor:wait;opacity:.65}.form-note{margin:11px 0 0;color:#8494ab;font-size:11.5px;text-align:center}.form-status{min-height:22px;margin:11px 0 0;font-size:13px;font-weight:700}.form-status[data-state=error]{color:var(--danger)}.form-status[data-state=success]{color:var(--ok)}",
  ".section{padding:92px 0}.section-head{max-width:760px}.section-head p{font-size:17.5px}.section h2{margin:0;font-size:clamp(32px,3.9vw,48px);line-height:1.08;letter-spacing:-.036em;font-weight:830}.section p{color:var(--muted);font-size:17px}.split{display:grid;grid-template-columns:minmax(0,.86fr) minmax(0,1.14fr);gap:72px;align-items:start}",
  ".problem{background:#fff}.problem-copy{border-left:4px solid var(--accent);border-radius:0 var(--radius) var(--radius) 0;background:linear-gradient(90deg,var(--accent-soft),transparent 70%);padding:26px 26px 26px 28px}.problem-copy p{margin:0 0 14px;font-size:17.5px;color:#33415c}.problem-copy p:last-child{margin:0}.problem-copy strong{color:var(--ink)}",
  ".architecture-block{background:var(--paper);border-bottom:1px solid var(--line);padding:56px 0}.architecture-block h2{font-size:clamp(26px,3vw,36px)}.architecture-block p{font-size:17px}",
  ".mechanism{background:var(--paper)}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:40px;counter-reset:step}.steps article{position:relative;border:1px solid var(--line);border-radius:var(--radius);background:#fff;padding:26px 22px 24px;box-shadow:var(--shadow-sm);transition:transform .18s,box-shadow .18s}.steps article:hover{transform:translateY(-4px);box-shadow:var(--shadow)}.steps i{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,var(--accent-soft),#fff);border:1px solid color-mix(in srgb,var(--accent) 22%,#fff);color:var(--accent);font-style:normal;font-size:15px;font-weight:900}.steps article:not(:last-child):after{content:'';position:absolute;top:44px;right:-13px;width:12px;height:12px;border-top:2px solid #b9c6da;border-right:2px solid #b9c6da;transform:rotate(45deg)}.steps h3{margin:18px 0 8px;font-size:17.5px;letter-spacing:-.015em}.steps p{margin:0;font-size:14.5px;line-height:1.55}",
  ".offer{background:#fff}.offer-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:40px}.offer-grid article{border:1px solid var(--line);border-radius:var(--radius);background:#fff;padding:26px;box-shadow:var(--shadow-sm);transition:transform .18s,box-shadow .18s,border-color .18s}.offer-grid article:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--accent) 35%,var(--line));box-shadow:var(--shadow)}.offer-grid b{display:inline-block;border-radius:6px;background:var(--accent-soft);padding:4px 10px;color:var(--accent-deep);font-size:11.5px;letter-spacing:.09em}.offer-grid h3{margin:15px 0 7px;font-size:18px}.offer-grid p{margin:0;font-size:14.5px}",
  ".compare{background:var(--paper)}.compare-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:40px}.compare-col{border:1px solid var(--line);border-radius:var(--radius);background:#fff;padding:28px;box-shadow:var(--shadow-sm)}.compare-col.win{border-color:color-mix(in srgb,var(--accent) 45%,var(--line));box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 9%,transparent),var(--shadow)}.compare-col header{display:flex;align-items:center;gap:10px;margin-bottom:18px;font-size:16px;font-weight:850;letter-spacing:-.015em}.compare-col.win header{color:var(--accent-deep)}.compare-col ul{display:grid;gap:12px;margin:0;padding:0;list-style:none}.compare-col li{position:relative;padding-left:27px;font-size:14.5px;color:#41506a;line-height:1.5}.compare-col.lose li:before{content:'';position:absolute;left:2px;top:3px;width:15px;height:15px;background:#c3552f;mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z'/%3E%3C/svg%3E\") center/contain no-repeat}.compare-col.win li:before{content:'';position:absolute;left:0;top:3px;width:17px;height:17px;background:var(--ok);mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'/%3E%3C/svg%3E\") center/contain no-repeat}",
  ".qualification{background:linear-gradient(160deg,var(--dark),#14283f)}.qualification,.qualification h2{color:#fff}.qualification .eyebrow{color:#9dc0ff}.qualification p{color:#c7d2e2}.fit-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}.fit-box{border:1px solid rgba(255,255,255,.16);border-radius:var(--radius);background:rgba(255,255,255,.05);padding:26px;backdrop-filter:blur(4px)}.fit-box b{display:block;margin-bottom:15px;font-size:15.5px}.check-list,.cross-list{display:grid;gap:11px;margin:0;padding:0;list-style:none}.check-list li,.cross-list li{position:relative;padding-left:26px;color:#d8e1ed;font-size:14.5px}.check-list li:before{content:'✓';position:absolute;left:0;color:#5fe0a5;font-weight:900}.cross-list li:before{content:'–';position:absolute;left:2px;color:#f6a7a0;font-weight:900}",
  ".proof{background:linear-gradient(180deg,var(--accent-soft),#fff)}.proof .wrap{position:relative}.proof-mark{position:absolute;top:-34px;left:-6px;font-family:Georgia,serif;font-size:150px;line-height:1;color:color-mix(in srgb,var(--accent) 22%,transparent);pointer-events:none}.proof blockquote{position:relative;max-width:940px;margin:18px 0 0;font-size:clamp(23px,3.2vw,36px);line-height:1.3;font-weight:750;letter-spacing:-.024em}.proof cite{display:block;margin-top:20px;color:var(--muted);font-size:14px;font-style:normal;font-weight:700}",
  ".pricing{background:var(--paper)}.price-card{position:relative;border:1px solid color-mix(in srgb,var(--accent) 30%,var(--line));border-radius:var(--radius);background:#fff;padding:32px;box-shadow:var(--shadow)}.price-card:before{content:'';position:absolute;top:0;left:0;right:0;height:5px;border-radius:var(--radius) var(--radius) 0 0;background:linear-gradient(90deg,var(--accent),var(--accent-deep))}.price-card span{display:inline-block;border-radius:6px;background:var(--accent-soft);padding:5px 10px;color:var(--accent-deep);font-size:11px;font-weight:900;letter-spacing:.12em}.price-card strong{display:block;margin:14px 0 6px;font-size:42px;letter-spacing:-.03em}.price-card small{display:block;margin-bottom:22px;color:var(--muted);font-size:13.5px;line-height:1.55}.price-card .button{width:100%}",
  ".guarantee{background:#fff}.guarantee-card{display:grid;grid-template-columns:auto 1fr;gap:26px;align-items:start;border:1px solid color-mix(in srgb,var(--ok) 35%,var(--line));border-radius:var(--radius);background:linear-gradient(135deg,var(--ok-soft),#fff 65%);padding:34px;box-shadow:var(--shadow-sm)}.guarantee-shield{width:64px;height:64px;flex:none;background:var(--ok);mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.58L18 9l-8 8z'/%3E%3C/svg%3E\") center/contain no-repeat}.guarantee-card h3{margin:0 0 10px;font-size:22px;letter-spacing:-.02em}.guarantee-card p{margin:0;font-size:17px;color:#2c3b52;line-height:1.6}.guarantee .eyebrow{color:var(--ok)}",
  ".faq{background:var(--paper)}.faq details{border:1px solid var(--line);border-radius:12px;background:#fff;margin-top:12px;padding:0 22px;box-shadow:var(--shadow-sm);transition:border-color .15s}.faq details[open]{border-color:color-mix(in srgb,var(--accent) 35%,var(--line))}.faq summary{position:relative;cursor:pointer;padding:19px 34px 19px 0;font-size:16.5px;font-weight:800;letter-spacing:-.015em;list-style:none}.faq summary::-webkit-details-marker{display:none}.faq summary:after{content:'+';position:absolute;right:2px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:var(--accent-soft);color:var(--accent);font-size:17px;font-weight:800;transition:transform .18s}.faq details[open] summary:after{content:'–'}.faq details p{max-width:800px;margin:0;padding:0 0 20px;font-size:15px}",
  ".final-cta{position:relative;background:linear-gradient(160deg,var(--dark),#14283f 55%,color-mix(in srgb,var(--accent) 55%,#14283f));color:#fff;text-align:center;overflow:hidden}.final-cta:before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);background-size:24px 24px;pointer-events:none}.final-cta .wrap{position:relative}.final-cta .eyebrow{color:#9dc0ff}.final-cta h2{max-width:800px;margin:0 auto;color:#fff}.final-cta p{max-width:640px;margin:18px auto 30px;color:#c7d2e2}.final-cta .button{border-color:#fff;background:#fff;color:var(--accent-deep);box-shadow:0 14px 40px rgba(0,0,0,.35)}.final-cta .button:hover{filter:none;background:#f2f6ff}",
  ".market-stats{position:relative;background:linear-gradient(160deg,var(--dark),#14283f 60%,color-mix(in srgb,var(--accent) 45%,#14283f));color:#fff;padding:64px 0;overflow:hidden}.market-stats:before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px);background-size:24px 24px;pointer-events:none}.market-stats .wrap{position:relative}.market-stats .eyebrow{color:#9dc0ff}.market-stats h2{margin:4px 0 0;max-width:720px;font-size:clamp(27px,3.4vw,40px);line-height:1.1;letter-spacing:-.032em;font-weight:830;color:#fff}.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-top:34px}.stat{border:1px solid rgba(255,255,255,.14);border-radius:var(--radius);background:rgba(255,255,255,.05);padding:22px 22px 20px;backdrop-filter:blur(4px)}.stat b{display:flex;align-items:baseline;gap:5px;font-size:clamp(30px,3.6vw,46px);font-weight:850;letter-spacing:-.04em;line-height:1}.stat b i{font-style:normal}.stat b em{font-style:normal;font-size:.42em;font-weight:800;color:#9dc0ff;letter-spacing:0}.stat span{display:block;margin-top:9px;color:#c7d2e2;font-size:13px;line-height:1.5}.stats-note{margin:26px 0 0;color:#8fa3bb;font-size:12px;max-width:720px}",
  ".form-trust{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 16px;margin:13px 0 0;padding:0;list-style:none}.form-trust li{position:relative;padding-left:19px;color:#8494ab;font-size:11px;font-weight:650}.form-trust li:before{content:'';position:absolute;left:0;top:1px;width:13px;height:13px;background:var(--ok);mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.58L18 9l-8 8z'/%3E%3C/svg%3E\") center/contain no-repeat;opacity:.75}",
  ".read-progress{position:fixed;top:0;left:0;z-index:60;height:3px;width:0;background:linear-gradient(90deg,var(--accent),var(--accent-deep));transition:width .1s linear}",
  ".reveal{opacity:0;transform:translateY(22px);transition:opacity .6s cubic-bezier(.2,.65,.3,1),transform .6s cubic-bezier(.2,.65,.3,1)}.reveal.in{opacity:1;transform:none}.topbar.scrolled{box-shadow:0 6px 24px rgba(15,35,64,.09)}@media print{.reveal{opacity:1;transform:none}}",
  ".site-footer{padding:38px 0;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px;background:#fff}.footer-grid{display:flex;justify-content:space-between;gap:24px;align-items:center}.footer-grid nav{display:flex;flex-wrap:wrap;align-items:center;gap:16px}.analytics-manage{border:0;background:transparent;padding:0;color:inherit;font:inherit;font-weight:750;text-decoration:underline;cursor:pointer}.mobile-cta{display:none}",
  ".analytics-consent{position:fixed;right:18px;bottom:18px;z-index:40;width:min(510px,calc(100% - 36px));border:1px solid var(--line);border-top:4px solid var(--accent);border-radius:12px;background:#fff;padding:22px;box-shadow:0 24px 70px rgba(15,35,64,.25)}.analytics-consent[hidden]{display:none}.analytics-consent b{display:block;font-size:17px}.analytics-consent p{margin:7px 0 15px;color:var(--muted);font-size:13px}.analytics-consent a{font-weight:750}.consent-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}.consent-actions button{min-height:42px}.consent-actions .secondary{border-color:var(--line);background:#fff;color:var(--ink)}",
  ".theme-direct .hero{background:#0d1b2d;color:#fff}.theme-direct .hero{background:linear-gradient(155deg,#0d1b2d,#13293f 60%,#16324b)}.theme-direct .hero:before{background-image:radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px)}.theme-direct .hero .lead{color:#c3cfdd}.theme-direct .hero .eyebrow{color:#9fc0ff}.theme-direct .zone-badge{border-color:rgba(255,255,255,.28);background:rgba(255,255,255,.08);color:#dbe7ff}.theme-direct .hero h1{max-width:15ch;letter-spacing:-.055em}.theme-direct .hero-grid{grid-template-columns:minmax(0,1.18fr) minmax(400px,.74fr)}.theme-direct .proof-pills li,.theme-direct .process-trust{border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff}.theme-direct .process-trust div{border-color:rgba(255,255,255,.16)}.theme-direct .process-trust b{color:#fff}.theme-direct .process-trust span{color:#b9c6d6}.theme-direct .proof-pills li{color:#e3ecf7}.theme-direct .hero .button.secondary{border-color:rgba(255,255,255,.4);background:transparent;color:#fff;box-shadow:none}.theme-direct .lead-form{border:0;box-shadow:0 24px 70px rgba(0,0,0,.35)}",
  ".theme-premium{background:#fbf8f2}.theme-premium .topbar{background:rgba(251,248,242,.94)}.theme-premium .hero{background:radial-gradient(1100px 480px at 85% -10%,rgba(157,132,84,.14),transparent 60%),linear-gradient(180deg,#faf6ee,#f1ece3)}.theme-premium .hero:before{background-image:radial-gradient(rgba(80,65,40,.07) 1px,transparent 1px)}.theme-premium .hero h1,.theme-premium .section h2,.theme-premium .form-head h2,.theme-premium .final-cta h2,.theme-premium blockquote,.theme-premium .guarantee-card h3{font-family:Georgia,\"Times New Roman\",serif;font-weight:600;letter-spacing:-.03em}.theme-premium .hero h1{max-width:18ch}.theme-premium .button,.theme-premium .brand-mark,.theme-premium .lead-form,.theme-premium .fields input,.theme-premium .fields select,.theme-premium .fields textarea,.theme-premium .steps article,.theme-premium .offer-grid article,.theme-premium .fit-box,.theme-premium .price-card,.theme-premium .compare-col,.theme-premium .guarantee-card,.theme-premium .faq details{border-radius:0}.theme-premium .lead-form{border:1px solid #cfc5b5;box-shadow:0 20px 55px rgba(63,52,38,.15)}.theme-premium .lead-form:before{border-radius:0}.theme-premium .price-card:before{border-radius:0}.theme-premium .qualification{background:#292722}.theme-premium .final-cta{background:linear-gradient(160deg,#292722,#3a352c)}.theme-premium .architecture-block,.theme-premium .mechanism,.theme-premium .pricing,.theme-premium .compare,.theme-premium .faq{background:#f1ece3}.theme-premium .proof{background:#e8dfd0}.theme-premium .zone-badge{border-color:#cfc5b5;color:#6d5c3f}",
  "@media(max-width:900px){.hero-grid,.split{grid-template-columns:1fr;gap:38px}.hero-copy{padding-top:4px}.hero h1{font-size:46px}.lead-form{max-width:680px}.steps{grid-template-columns:1fr 1fr}.steps article:not(:last-child):after{display:none}.fit-columns,.compare-grid{grid-template-columns:1fr}.section{padding:70px 0}}",
  "@media(max-width:620px){.wrap{width:min(100% - 28px,1180px)}.topbar .wrap{min-height:62px}.topbar nav>a:not(.button){display:none}.topbar nav .button{display:none}.hero{padding:40px 0 48px}.hero h1{font-size:37px;line-height:1.06}.hero .lead{font-size:17px}.hero-actions{display:grid}.hero-actions .button{width:100%}.process-trust{grid-template-columns:1fr}.process-trust div{border-right:0;border-bottom:1px solid var(--line)}.process-trust div:last-child{border-bottom:0}.fields{grid-template-columns:1fr}.fields .wide{grid-column:auto}.lead-form{padding:24px}.steps,.offer-grid{grid-template-columns:1fr}.section h2{font-size:31px}.guarantee-card{grid-template-columns:1fr;padding:26px}.footer-grid{display:grid;text-align:left}.mobile-cta{position:fixed;right:12px;bottom:12px;left:12px;z-index:25;display:flex;box-shadow:0 12px 34px rgba(15,35,64,.32)}body{padding-bottom:76px}}",
  "@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.button,.steps article,.offer-grid article{transition:none}.zone-badge i:after{animation:none}.reveal{opacity:1;transform:none;transition:none}.hero-copy>*,.hero .lead-form{opacity:1;transform:none;animation:none}.button:not(.secondary):after{display:none}}",
  ".theme-premium .market-stats{background:linear-gradient(160deg,#292722,#3a352c)}.theme-premium .stat{border-radius:0}.theme-premium .stat b em,.theme-premium .market-stats .eyebrow{color:#cbb98d}",
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

const cap = (value: string) => (value ? value.charAt(0).toLocaleUpperCase("es") + value.slice(1) : value);

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

  const isRedVitalia = /^redvitalia/i.test(clean(brief.brand));
  const rvLogo = (textColor: string) =>
    "<svg class=\"brand-logo-rv\" viewBox=\"0 0 178 40\" width=\"178\" height=\"40\" role=\"img\" aria-label=\"RedVitalia\" xmlns=\"http://www.w3.org/2000/svg\"><defs><linearGradient id=\"rvlg\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#1f7bff\"/><stop offset=\"1\" stop-color=\"#0a3d91\"/></linearGradient></defs><rect width=\"40\" height=\"40\" rx=\"11\" fill=\"url(#rvlg)\"/><path d=\"M12 28V12h8.2c3 0 5 1.8 5 4.4 0 2-1.1 3.4-2.9 4l3.3 7.6h-4l-2.9-7h-2.9v7z\" fill=\"#fff\" opacity=\"0\"/><text x=\"20\" y=\"26.8\" text-anchor=\"middle\" font-family=\"Inter,ui-sans-serif,-apple-system,'Segoe UI',sans-serif\" font-weight=\"900\" font-size=\"16.5\" letter-spacing=\".5\" fill=\"#fff\">RV</text><text x=\"51\" y=\"27\" font-family=\"Inter,ui-sans-serif,-apple-system,'Segoe UI',sans-serif\" font-weight=\"850\" font-size=\"19.5\" letter-spacing=\"-.5\" fill=\"" + textColor + "\">Red<tspan font-weight=\"600\">Vitalia</tspan></text></svg>";
  const logo = logoUrl
    ? "<img src=\"" + esc(logoUrl) + "\" alt=\"" + brand + "\" class=\"brand-logo\" width=\"172\" height=\"38\">"
    : isRedVitalia
      ? rvLogo("#0f172a")
      : "<span class=\"brand-mark\">" + brand.slice(0, 2).toUpperCase() + "</span><b>" + brand + "</b>";

  const media = heroImageUrl
    ? "<figure class=\"hero-media\"><img src=\"" + esc(heroImageUrl) + "\" alt=\"" + service + " en " + zone + "\" width=\"960\" height=\"540\" fetchpriority=\"high\" decoding=\"async\"></figure>"
    : "<div class=\"process-trust\" aria-label=\"Cómo abordamos cada solicitud\"><div><b>Revisión humana</b><span>Cada solicitud la valora una persona, no un autoresponder.</span></div><div><b>Alcance por escrito</b><span>Zona, condiciones y responsabilidades, antes de pagar nada.</span></div><div><b>Tú tienes la última palabra</b><span>Nada queda aceptado por enviar el formulario.</span></div></div>";

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
    ["Respuesta revisada por una persona", "Condiciones por escrito antes de pagar", "Sin letra pequeña escondida", ...(privacyUrl ? ["Responsable y privacidad visibles"] : [])],
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
  const verticalContent = VERTICAL_CONTENT[brief.verticalId] || null;
  const genericSteps = [
    { title: "Cuéntanos el contexto", text: "Recogemos " + clean(brief.filter) + "." },
    { title: "Revisamos el encaje", text: "Comprobamos alcance, zona y viabilidad antes de confirmar nada." },
    { title: "Recibes una respuesta", text: "Te explicamos el siguiente paso y las condiciones que aplican." },
    { title: "Decides si avanzar", text: "Solo se formaliza lo que ambas partes hayan revisado y aceptado." },
  ];
  const stepsOverride = (brief.stepsOverride || []).filter((step) => clean(step?.title) && clean(step?.text));
  const steps = context.automotive
    ? context.automotive.steps
    : stepsOverride.length >= 3
      ? stepsOverride.slice(0, 4)
      : verticalContent?.steps || genericSteps;
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
  const faqsOverride = (brief.faqsOverride || []).filter((faq) => clean(faq?.question) && clean(faq?.answer));
  const faqs = context.automotive
    ? context.automotive.faqs
    : faqsOverride.length >= 2
      ? faqsOverride.slice(0, 4)
      : verticalContent?.faqs || genericFaqs;

  const problemSection =
    "<section class=\"section problem\"><div class=\"wrap split\"><div><p class=\"eyebrow\">LA SITUACIÓN REAL</p><h2>Sabes lo que cuesta <span data-edit=\"pain\">" + pain + "</span></h2></div><div class=\"problem-copy\"><p data-edit=\"problem\">" +
    (clean(brief.problemOverride) ? esc(brief.problemOverride) : verticalContent ? esc(verticalContent.problema) : "No es falta de trabajo: es que sin criterio claro cada intento sale caro en tiempo, dinero y confianza.") +
    "</p><p>Aquí el objetivo es concreto: <strong>" + result + "</strong>. Y el camino está a la vista — sabrás qué se revisa, qué se promete y qué no, antes de dar ningún paso.</p></div></div></section>";
  const qualificationSection =
    "<section class=\"section qualification\"><div class=\"wrap split\"><div><p class=\"eyebrow\">ENCAJE</p><h2>Comprueba si esta es la ruta correcta para tu caso</h2><p>Está pensada para " + audience + ".</p></div><div class=\"fit-columns\"><div class=\"fit-box\"><b>Sí revisamos</b>" + listItems(accepted, "check-list") + "</div><div class=\"fit-box\"><b>No es esta ruta</b>" + listItems(rejected, "cross-list") + "</div></div></div></section>";
  const mechanismSection =
    "<section class=\"section mechanism\" id=\"proceso\"><div class=\"wrap\"><div class=\"section-head\"><p class=\"eyebrow\">PROCESO</p><h2>Un recorrido visible de principio a fin</h2><p>Cada paso tiene una función y evita pedir documentación antes de saber si merece la pena.</p></div><div class=\"steps\">" +
    steps
      .map(
        (step, index) =>
          "<article><i>" + String(index + 1).padStart(2, "0") + "</i><h3 data-edit=\"step:" + index + ":title\">" + esc(step.title) + "</h3><p data-edit=\"step:" + index + ":text\">" + esc(step.text) + "</p></article>",
      )
      .join("") +
    "</div></div></section>";
  const offerSection =
    "<section class=\"section offer\"><div class=\"wrap\"><div class=\"section-head\"><p class=\"eyebrow\">QUÉ RECIBES</p><h2>Una propuesta que deja claro el alcance</h2><p data-edit=\"offer\">" + offer + "</p></div><div class=\"offer-grid\"><article><b>01 · REVISIÓN</b><h3>Contexto antes de precio</h3><p>Se comprueban los datos necesarios para evitar respuestas genéricas.</p></article><article><b>02 · CRITERIO</b><h3>Encaje explicado</h3><p>Sabes por qué el caso puede avanzar o por qué no.</p></article><article><b>03 · CONDICIONES</b><h3>Responsabilidades visibles</h3><p>Quién hace cada trámite y qué queda pendiente se aclara antes de aceptar.</p></article><article><b>04 · SIGUIENTE PASO</b><h3>Una decisión concreta</h3><p>Avanzar, aportar un documento o detener el proceso sin perder más tiempo.</p></article></div></div></section>";
  const proofSection = proof
    ? "<section class=\"section proof\"><div class=\"wrap\"><span class=\"proof-mark\" aria-hidden=\"true\">“</span><p class=\"eyebrow\">PRUEBA IDENTIFICABLE</p><blockquote><span data-edit=\"proof\">" + proof + "</span><cite>Verificable — pide el detalle en la primera conversación.</cite></blockquote></div></section>"
    : "";
  const pricingSection = price
    ? "<section class=\"section pricing\"><div class=\"wrap split\"><div><p class=\"eyebrow\">PRECIO Y CONDICIONES</p><h2>La inversión aparece antes de pedir una decisión</h2><p>" + offer + "</p></div><article class=\"price-card\"><span>INVERSIÓN PUBLICADA</span><strong data-edit=\"price\">" + price + "</strong><small>Revisa impuestos, duración, renovación, cancelación y exclusiones en las condiciones.</small><a class=\"button\" href=\"#lead-form\">" + cta + "</a></article></div></section>"
    : "";
  const guaranteeSection = guarantee
    ? "<section class=\"section guarantee\"><div class=\"wrap\"><div class=\"section-head\"><p class=\"eyebrow\">COMPROMISO PUBLICABLE</p><h2>La garantía, por delante</h2></div><div class=\"guarantee-card\"><span class=\"guarantee-shield\" aria-hidden=\"true\"></span><div><h3>Por escrito en la propuesta, no en un anuncio</h3><p data-edit=\"guarantee\">" + guarantee + "</p></div></div></div></section>"
    : "";
  const statsItems = (brief.marketStats || [])
    .map((item) => ({ value: clean(item?.value), label: clean(item?.label) }))
    .filter((item) => item.value && item.label)
    .slice(0, 4);
  const statsSection = statsItems.length
    ? "<section class=\"market-stats\"><div class=\"wrap\"><p class=\"eyebrow\">EL MERCADO, EN CIFRAS</p><h2>Esta propuesta se apoya en datos del sector, no en promesas</h2><div class=\"stats-grid\">" +
      statsItems
        .map((item) => {
          const match = item.value.match(/^([\d.]+)\s*(.*)$/);
          const numeric = match && match[1].replace(/\./g, "").length <= 6 ? match : null;
          const body = numeric
            ? "<i data-count=\"" + esc(numeric[1].replace(/\D/g, "")) + "\">" + esc(numeric[1]) + "</i>" + (numeric[2] ? "<em>" + esc(numeric[2]) + "</em>" : "")
            : "<i>" + esc(item.value) + "</i>";
          return "<div class=\"stat\"><b>" + body + "</b><span>" + esc(item.label) + "</span></div>";
        })
        .join("") +
      "</div><p class=\"stats-note\">Fuente: análisis propio del sector de captación. Son cifras del estudio de mercado que sustenta esta propuesta; el detalle es verificable y se comparte en la primera conversación.</p></div></section>"
    : "";

  const compareSection =
    "<section class=\"section compare\"><div class=\"wrap\"><div class=\"section-head\"><p class=\"eyebrow\">LA DIFERENCIA</p><h2>Lo que te suelen vender, frente a cómo trabajamos</h2></div><div class=\"compare-grid\"><div class=\"compare-col lose\"><header>El proveedor típico</header><ul><li>Promete volumen sin comprobar tu zona ni tu capacidad real.</li><li>El precio aparece después de firmar, con sorpresas dentro.</li><li>Permanencias y renovaciones escondidas en la letra pequeña.</li><li>El mismo contacto se revende a varios competidores a la vez.</li><li>Responde un embudo automático; nadie estudia tu caso.</li></ul></div><div class=\"compare-col win\"><header>" + brand + "</header><ul><li>Zona y capacidad comprobadas antes de prometer nada.</li><li>Alcance, condiciones y responsabilidades por escrito y por adelantado.</li><li>Sin permanencia impuesta: la renovación se gana con resultados.</li><li>Cada " + esc(singular(brief.unit || "oportunidad")) + " se trata como tuyo, no como inventario.</li><li>Revisión humana de cada solicitud y respuesta con criterio.</li></ul></div></div></div></section>";

  const faqSection =
    "<section class=\"section faq\" id=\"faq\"><div class=\"wrap\"><div class=\"section-head\"><p class=\"eyebrow\">PREGUNTAS CLAVE</p><h2>Respuestas antes de pedirte que avances</h2></div>" +
    faqs
      .slice(0, brief.depth === "short" ? 2 : brief.depth === "standard" ? 3 : 4)
      .map((faq, faqIndex) => "<details><summary data-edit=\"faq:" + faqIndex + ":question\">" + esc(faq.question) + "</summary><p data-edit=\"faq:" + faqIndex + ":answer\">" + esc(faq.answer) + "</p></details>")
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
  const faqSchemaItems = faqs.slice(0, brief.depth === "short" ? 2 : brief.depth === "standard" ? 3 : 4);
  const faqSchema = faqSchemaItems.length
    ? "<script type=\"application/ld+json\">" +
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqSchemaItems.map((faq) => ({
          "@type": "Question",
          name: clean(faq.question),
          acceptedAnswer: { "@type": "Answer", text: clean(faq.answer) },
        })),
      }).replace(/</g, "\\u003c") +
      "</script>"
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
    "var rmq=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)');" +
    "if('IntersectionObserver' in window&&!(rmq&&rmq.matches)){var rvCount=function(el){var target=parseInt((el.getAttribute('data-count')||'').replace(/\\D/g,''),10);if(!target)return;var fin=el.textContent;var st=null;var fr=function(ts){if(st===null)st=ts;var p=Math.min(1,(ts-st)/900);el.textContent=String(Math.round(target*(p*p*(3-2*p))));if(p<1)requestAnimationFrame(fr);else el.textContent=fin};requestAnimationFrame(fr)};var rvIo=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(!entry.isIntersecting)return;entry.target.classList.add('in');rvIo.unobserve(entry.target);entry.target.querySelectorAll('[data-count]').forEach(rvCount)})},{threshold:.01,rootMargin:'0px 0px -6% 0px'});document.querySelectorAll('main section:not(.hero),.steps article,.offer-grid article,.compare-col,.guarantee-card').forEach(function(el){el.classList.add('reveal');rvIo.observe(el)})}" +
    "var rvTopbar=document.querySelector('.topbar');if(rvTopbar)window.addEventListener('scroll',function(){rvTopbar.classList.toggle('scrolled',window.scrollY>8)},{passive:true});" +
    "var rvProg=document.querySelector('.read-progress');if(rvProg)window.addEventListener('scroll',function(){var h=document.documentElement;var max=h.scrollHeight-h.clientHeight;rvProg.style.width=(max>0?(h.scrollTop/max)*100:0)+'%'},{passive:true});" +
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
    "</button><p class=\"form-note\">Enviar estos datos no confirma precio, disponibilidad ni aceptación del caso.</p><ul class=\"form-trust\"><li>Conexión cifrada</li><li>Tus datos no se revenden</li><li>Respuesta con criterio, no automática</li></ul><p class=\"form-status\" role=\"status\" aria-live=\"polite\"></p></form><!-- Formulario de " +
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
    "<link rel=\"icon\" type=\"image/svg+xml\" href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='11' fill='%231769e0'/%3E%3Ctext x='20' y='27' text-anchor='middle' font-family='Arial,sans-serif' font-weight='900' font-size='17' fill='white'%3ERV%3C/text%3E%3C/svg%3E\">",
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; img-src 'self' data: https:; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; connect-src 'self' " + esc(cspOrigins) + " https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com; font-src 'self' data:; base-uri 'self'; form-action 'self' " + esc(endpointOrigin) + "; frame-ancestors 'none'\">",
    schema,
    faqSchema,
    "<style>:root{--accent:" + accent + "}" + css + "</style></head><body class=\"theme-" + visualTheme + " architecture-" + architectureClass + "\"" + (context.publishable ? "" : " data-draft=\"true\"") + "><div class=\"read-progress\" aria-hidden=\"true\"></div>",
    "<header class=\"topbar\"><div class=\"wrap\"><a class=\"brand\" href=\"#\">" + logo + "</a><nav><a href=\"#proceso\">Proceso</a><a href=\"#faq\">Preguntas</a><a class=\"button\" href=\"#lead-form\">" + cta + "</a></nav></div></header>",
    "<main><section class=\"hero\"><div class=\"hero-art\" aria-hidden=\"true\"><svg viewBox=\"0 0 240 240\" xmlns=\"http://www.w3.org/2000/svg\">" +
    (verticalContent?.motif || "<circle cx=\"120\" cy=\"120\" r=\"70\"/>") +
    "</svg><i class=\"orb orb-a\"></i><i class=\"orb orb-b\"></i><span class=\"ring\"></span></div><div class=\"wrap hero-grid\"><div class=\"hero-copy\"><span class=\"zone-badge\"><i></i>Atendiendo " + zone + "</span><p class=\"eyebrow\">" + service + "</p><h1 data-edit=\"headline\">" + headline + "</h1><p class=\"lead\" data-edit=\"sub\">" + subheadline + "</p><div class=\"hero-actions\"><a class=\"button\" href=\"#lead-form\" data-edit=\"cta\">" + cta + "</a><a class=\"button secondary\" href=\"#proceso\">Ver cómo funciona</a></div>" + trustPills + media + "</div>" + form + "</div></section>",
    statsSection,
    architectureSections[brief.architecture],
    renderedSections,
    compareSection,
    "<section class=\"section final-cta\"><div class=\"wrap\"><p class=\"eyebrow\">SIGUIENTE PASO</p><h2>" + esc(cap(clean(brief.result || "Una respuesta clara y un siguiente paso útil"))) + "</h2><p>Dos minutos de contexto por tu parte. Una revisión honesta por la nuestra. Sin compromiso hasta que veas la propuesta.</p><a class=\"button\" href=\"#lead-form\">" + cta + "</a></div></section></main>",
    "<footer class=\"site-footer\"><div class=\"wrap footer-grid\"><div>" + (isRedVitalia && !logoUrl ? "<div class=\"footer-logo\">" + rvLogo("#0f172a").replace("rvlg", "rvlgf") + "</div>" : "") + "<b>" + legalIdentity + "</b><br>" + service + " · " + zone + "</div><nav>" + legalLinks + consentManager + "</nav></div></footer>",
    "<a class=\"button mobile-cta\" href=\"#lead-form\">" + cta + "</a>",
    consentBanner,
    "<noscript><div class=\"wrap\" role=\"alert\">Necesitas JavaScript para confirmar el estado del envío. También puedes usar el formulario con su destino configurado.</div></noscript>",
    script,
    "</body></html>",
  ].join("");
};
