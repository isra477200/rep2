import { createRequire } from "node:module";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const profile = process.env.USERPROFILE;
    if (!profile) throw new Error("Playwright no está disponible.");
    return require(
      join(
        profile,
        ".cache",
        "codex-runtimes",
        "codex-primary-runtime",
        "dependencies",
        "node",
        "node_modules",
        "playwright",
      ),
    );
  }
}

async function chromeExecutable() {
  const candidates = [
    process.env.PROGRAMFILES
      ? join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe")
      : null,
    process.env["PROGRAMFILES(X86)"]
      ? join(
          process.env["PROGRAMFILES(X86)"],
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        )
      : null,
    process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
      : null,
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Sigue con el siguiente navegador instalado.
    }
  }
  return undefined;
}

const baseUrl = process.argv.find((value) => value.startsWith("--base="))?.slice(7) ||
  "http://localhost:3000/";
const limit = Number(
  process.argv.find((value) => value.startsWith("--limit="))?.slice(8) || Infinity,
);
const allowMissingDeep = process.argv.includes("--allow-missing-deep");
const companies = JSON.parse(await readFile("public/data/companies-index.json", "utf8")).slice(
  0,
  Number.isFinite(limit) ? limit : undefined,
);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  executablePath: await chromeExecutable(),
  args: ["--disable-background-networking", "--disable-component-update"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
let currentId = "inicio";
const failures = [];
const networkFailures = [];

page.on("pageerror", (error) => {
  failures.push({ id: currentId, type: "pageerror", detail: error.message });
});
page.on("response", (response) => {
  if (response.status() < 400) return;
  const url = response.url();
  if (allowMissingDeep && /\/data\/funnel-v3\//.test(url) && response.status() === 404)
    return;
  networkFailures.push({ id: currentId, status: response.status(), url });
});

await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForFunction(() => document.body.innerText.includes("712"), null, {
  timeout: 30_000,
});

for (const [index, company] of companies.entries()) {
  currentId = company.id;
  try {
    await page.evaluate((id) => {
      const url = new URL(window.location.href);
      url.searchParams.set("empresa", id);
      url.searchParams.delete("media");
      window.history.replaceState({ empresa: id }, "", url);
      window.dispatchEvent(new PopStateEvent("popstate", { state: { empresa: id } }));
    }, company.id);
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForFunction(
      () =>
        !document.body.innerText.includes("Cargando la investigación comercial anterior") &&
        !document.body.innerText.includes("Cargando la auditoría comercial profunda"),
      null,
      { timeout: 12_000 },
    );
    const state = await dialog.evaluate((element) => ({
      label: element.getAttribute("aria-label") || "",
      errorBoundary: /This page couldn.t load|Reload to try again/i.test(document.body.innerText),
      brokenImages: [...element.querySelectorAll("img")]
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.getAttribute("src") || ""),
    }));
    if (!state.label.includes(company.name))
      failures.push({
        id: company.id,
        type: "wrong-dialog",
        detail: `Esperado ${company.name}; obtenido ${state.label}`,
      });
    if (state.errorBoundary)
      failures.push({ id: company.id, type: "error-boundary", detail: "La ficha se rompió." });
    if (state.brokenImages.length)
      failures.push({
        id: company.id,
        type: "broken-image",
        detail: state.brokenImages.join(" · "),
      });
  } catch (error) {
    failures.push({ id: company.id, type: "navigation", detail: error.message });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  }
  if ((index + 1) % 50 === 0 || index + 1 === companies.length)
    console.log(`[smoke] ${index + 1}/${companies.length}`);
}

await browser.close();
const uniqueFailures = [
  ...new Map(
    [...failures, ...networkFailures].map((row) => [
      `${row.id}|${row.type || row.status}|${row.detail || row.url}`,
      row,
    ]),
  ).values(),
];
const report = {
  schemaVersion: "rv-record-runtime-smoke-v1",
  generatedAt: new Date().toISOString(),
  baseUrl,
  totalExpected: companies.length,
  scanned: companies.length,
  failures: uniqueFailures,
  passed: uniqueFailures.length === 0,
};
const output = "audit/ui-v3/runtime-smoke.json";
await mkdir(dirname(output), { recursive: true });
await writeFile(`${output}.tmp`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await rename(`${output}.tmp`, output);
console.log(JSON.stringify({ scanned: report.scanned, failures: uniqueFailures.length, output }));
if (!report.passed) process.exitCode = 1;
