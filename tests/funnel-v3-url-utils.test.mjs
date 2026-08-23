import test from "node:test";
import assert from "node:assert/strict";
import { safePublicUrl } from "../scripts/funnel-v3-url-utils.mjs";

test("rechaza marcadores y enlaces truncados antes de sintetizar", () => {
  assert.equal(safePublicUrl("[[CALENDLY]]"), null);
  assert.equal(safePublicUrl("https://www.facebook.com/ads/library/?sort_data\\"), null);
});

test("repara solo el paréntesis espurio documentado de ss.ge", () => {
  assert.equal(
    safePublicUrl("https://ss.ge/ka/home/help?index=0)"),
    "https://ss.ge/ka/home/help?index=0",
  );
});

test("conserva una URL pública válida y retira rastreo", () => {
  assert.equal(
    safePublicUrl("https://example.com/path?utm_source=test&id=7#fragment"),
    "https://example.com/path?id=7",
  );
});
