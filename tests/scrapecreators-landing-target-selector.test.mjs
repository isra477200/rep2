import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLandingTargetProposal,
  inspectCommercialUrl,
  urlIdentity,
} from "../scripts/update-scrapecreators-landing-targets.mjs";

test("the selector only accepts stable public commercial pages", () => {
  const blocked = [
    ["https://www.facebook.com/ads/library/?id=1", "platform_or_cdn"],
    ["https://scontent-mad1-1.xx.fbcdn.net/file.jpg", "platform_or_cdn"],
    ["https://example.es/politica-de-privacidad", "legal_or_privacy"],
    ["https://example.es/poltica-de-privacidad", "legal_or_privacy"],
    ["https://example.es/texto_legal", "legal_or_privacy"],
    ["https://privacypolicies.com/live/abc", "legal_or_privacy"],
    ["https://wa.me/34600000000", "platform_or_cdn"],
    ["https://calendly.com/example/demo", "calendar_only"],
    ["https://portal.example.es/appointment/1", "calendar_only"],
    ["https://calendar.example.es/widget/bookings/demo-leads", "calendar_only"],
    ["https://sites.leadconnectorhq.com/preview/abc", "ephemeral_path"],
    ["https://docs.google.com/document/d/abc/edit", "non_commercial_platform"],
    ["https://forms.gle/abcdef", "form_only"],
    ["https://example.es/vsl?invite_token=secret", "ephemeral_query"],
    ["https://example.es/vsl?r=%7B%7Bad.id%7D%7D", "template_or_broken_url"],
    ["https://example.es/gracias-webinar", "post_conversion"],
    ["https://example.es/webinar-registro-completado1745001904139", "post_conversion"],
    ["http://127.0.0.1/offer", "private_host"],
    ["https://example.es/creative.png", "asset_not_page"],
  ];
  for (const [url, reason] of blocked) {
    const result = inspectCommercialUrl(url);
    assert.equal(result.accepted, false, url);
    assert.equal(result.reason, reason, url);
  }

  assert.deepEqual(
    inspectCommercialUrl("https://vsl.example.es/optin-vsl?utm_source=meta#hero"),
    {
      accepted: true,
      reason: null,
      url: "https://vsl.example.es/optin-vsl",
      identity: "vsl.example.es/optin-vsl",
      hostname: "vsl.example.es",
      role: "landing",
      hasOfferPath: true,
      isHomepage: false,
      genericHost: false,
    },
  );
  assert.equal(inspectCommercialUrl("https://example.es/agenda-auditoria").accepted, true);
  assert.equal(inspectCommercialUrl("https://partners.example.es/agenda-tu-llamada").accepted, true);
});

test("URL identity collapses scheme, www, tracking and trailing slash variants", () => {
  const first = inspectCommercialUrl("http://www.example.es/oferta/?utm_campaign=x");
  const second = inspectCommercialUrl("https://example.es/oferta");
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.equal(first.identity, second.identity);
  assert.equal(urlIdentity(first.url), urlIdentity(second.url));
});

test("the proposal preserves existing targets, requires matched page IDs and prefers own offer routes", () => {
  const proposal = buildLandingTargetProposal({
    normalized: {
      items: [
        {
          pageId: "page-a",
          observedPageIds: ["page-a"],
          isActive: true,
          landing: {
            urls: [
              "https://agency.example/",
              "https://agency.example/vsl/captacion",
              "https://agency.example/privacy-policy",
              "https://calendly.com/agency/demo",
            ],
          },
        },
        {
          pageId: "quarantine-page",
          landing: { urls: ["https://must-not-appear.example/oferta"] },
        },
        {
          pageId: "page-b",
          landing: { urls: ["https://second.example/oferta"] },
        },
      ],
    },
    companyMap: {
      pageIds: {
        "page-a": { companyId: "agency", status: "matched" },
        "page-b": { companyId: "second", status: "matched" },
        "quarantine-page": { companyId: null, status: "quarantine" },
      },
    },
    companies: [
      {
        id: "agency",
        name: "Agency",
        domain: "agency.example",
        website: "https://agency.example/",
        funnel: "Anuncio → https://agency.example/vsl/captacion",
        sources: [],
      },
      {
        id: "second",
        name: "Second",
        domain: "second.example",
        website: "https://second.example/",
        funnel: "",
        sources: [],
      },
    ],
    existingTargets: {
      schema: "targets-v1",
      generatedAt: "2026-01-01",
      note: "keep me",
      items: [
        { id: "legacy", name: "Legacy", url: "https://legacy.example/", role: "homepage" },
        { id: "second", name: "Second", url: "https://second.example/oferta", role: "landing" },
      ],
    },
    ids: new Set(["agency"]),
    maxPerCompany: 1,
  });

  assert.deepEqual(proposal.document.items.slice(0, 2), [
    { id: "legacy", name: "Legacy", url: "https://legacy.example/", role: "homepage" },
    { id: "second", name: "Second", url: "https://second.example/oferta", role: "landing" },
  ]);
  assert.deepEqual(proposal.additions, [
    {
      id: "agency",
      name: "Agency",
      url: "https://agency.example/vsl/captacion",
      role: "landing",
    },
  ]);
  assert.equal(proposal.decisions[0].ownDomain, true);
  assert.equal(proposal.decisions[0].brandAligned, false);
  assert.ok(proposal.decisions[0].sources.includes("normalized_ad_landing"));
  assert.equal(proposal.summary.selectedCompanies, 1);
  assert.equal(proposal.summary.proposed, 1);
  assert.equal(proposal.document.note, "keep me");
  assert.doesNotMatch(JSON.stringify(proposal.document), /must-not-appear/);
});

test("an existing URL is never appended again even with a different scheme", () => {
  const proposal = buildLandingTargetProposal({
    normalized: {
      items: [{ pageId: "page", landing: { urls: ["https://www.example.es/oferta/"] } }],
    },
    companyMap: { pageIds: { page: { companyId: "example", status: "matched" } } },
    companies: [
      {
        id: "example",
        name: "Example",
        domain: "example.es",
        website: "https://example.es/",
        funnel: "",
        sources: [],
      },
    ],
    existingTargets: {
      items: [
        { id: "example", name: "Example", url: "http://example.es/oferta", role: "landing" },
      ],
    },
  });
  assert.equal(proposal.additions.length, 1);
  assert.equal(proposal.additions[0].url, "https://example.es/");
  assert.equal(
    proposal.document.items.filter((target) => urlIdentity(target.url) === "example.es/oferta").length,
    1,
  );
});

test("brand-aligned hosted pages and detailed fiche sources are eligible but unrelated pages are not", () => {
  const proposal = buildLandingTargetProposal({
    normalized: {
      items: [
        {
          pageId: "page-brand",
          landing: {
            urls: [
              "https://subscribepage.io/BrandHostedAgency",
              "https://unrelated.example/contacto",
            ],
          },
        },
      ],
    },
    companyMap: {
      pageIds: {
        "page-brand": { companyId: "brand-hosted-agency", status: "matched" },
      },
    },
    companies: [
      {
        id: "brand-hosted-agency",
        name: "Brand Hosted Agency",
        domain: "",
        website: "",
        funnel: "",
        sources: [],
      },
    ],
    companyDetails: [
      {
        id: "brand-hosted-agency",
        sources: ["https://landing.example/BrandHostedAgency/vsl"],
        body: "Fuente adicional: https://landing.example/BrandHostedAgency/vsl",
      },
    ],
    existingTargets: { items: [] },
    maxPerCompany: 2,
  });

  assert.deepEqual(
    proposal.additions.map((target) => target.url).sort(),
    [
      "https://landing.example/BrandHostedAgency/vsl",
      "https://subscribepage.io/BrandHostedAgency",
    ].sort(),
  );
  assert.ok(proposal.decisions.every((decision) => decision.brandAligned));
  assert.ok(proposal.decisions.some((decision) => decision.sources.includes("company_detail")));
  assert.doesNotMatch(JSON.stringify(proposal.document), /unrelated\.example/u);
});
