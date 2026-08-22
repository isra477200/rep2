import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("las capturas V3 conservan su colección, URL y navegación propias", async () => {
  const [portal, panel] = await Promise.all([
    readFile(new URL("app/Portal.tsx", root), "utf8"),
    readFile(new URL("app/FunnelV3Panel.tsx", root), "utf8"),
  ]);

  assert.match(panel, /collection,\s*"funnel"/);
  assert.match(portal, /source === "funnel" \? "evidence" : "media"/);
  assert.match(portal, /current\.collection\.length/);
  assert.match(portal, /funnelScreenshotMedia\(review\)/);
  assert.match(portal, /if \(!active\) url\.searchParams\.delete\("empresa"\)/);
  assert.doesNotMatch(
    portal,
    /company\.media\.findIndex\(\(item\) => item\.file === media\.file\)/,
  );
});

test("el visor modal gestiona foco de entrada, ciclo y restauración", async () => {
  const portal = await readFile(new URL("app/Portal.tsx", root), "utf8");
  assert.match(portal, /lightboxCloseRef\.current\?\.focus\(\)/);
  assert.match(portal, /e\.key === "Tab"/);
  assert.match(portal, /priorFocus\.focus\(\)/);
  assert.match(portal, /aria-describedby="lightbox-caption"/);
});
