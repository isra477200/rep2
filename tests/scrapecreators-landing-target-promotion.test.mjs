import assert from "node:assert/strict";
import test from "node:test";

import {
  createLandingTargetAudit,
  prepareAuditedPromotion,
  verifyHashBindings,
} from "../scripts/promote-scrapecreators-landing-targets.mjs";
import { buildLandingTargetProposal } from "../scripts/update-scrapecreators-landing-targets.mjs";

const fixtures = () => {
  const currentTargets = {
    schema: "targets-v1",
    generatedAt: "2026-01-01",
    items: [{ id: "legacy", name: "Legacy", url: "https://legacy.example/", role: "homepage" }],
  };
  const companyMap = {
    pageIds: {
      accepted: { companyId: "accepted", status: "matched" },
      insecure: { companyId: "insecure", status: "matched" },
      manual: { companyId: "manual", status: "matched" },
    },
  };
  const companies = [
    { id: "accepted", name: "Accepted", domain: "accepted.example", website: "", funnel: "", sources: [] },
    { id: "insecure", name: "Insecure", domain: "insecure.example", website: "", funnel: "", sources: [] },
    { id: "manual", name: "Manual", domain: "manual.example", website: "", funnel: "", sources: [] },
  ];
  const normalized = {
    items: [
      { pageId: "accepted", landing: { urls: ["https://accepted.example/vsl"] } },
      { pageId: "insecure", landing: { urls: ["http://insecure.example/oferta"] } },
      { pageId: "manual", landing: { urls: ["https://manual.example/whatsapp-free"] } },
    ],
  };
  const expectedProposal = buildLandingTargetProposal({
    normalized,
    companyMap,
    companies,
    companyDetails: [],
    existingTargets: currentTargets,
  });
  return { currentTargets, companyMap, companies, expectedProposal };
};

test("audit covers every candidate and documents automatic and manual rejections", () => {
  const { currentTargets, companyMap, companies, expectedProposal } = fixtures();
  const audit = createLandingTargetAudit({
    proposal: expectedProposal.document,
    proposalSha256: "proposal-hash",
    currentTargets,
    expectedProposal,
    companyMap,
    companies,
    sourceHashes: { canonicalTargets: "canonical-hash" },
    manualRejections: new Map([["manual", "Ruta puente de WhatsApp no durable"]]),
  });

  assert.equal(audit.candidateCount, 3);
  assert.equal(audit.acceptedCount, 1);
  assert.equal(audit.rejectedCount, 2);
  assert.deepEqual(audit.items.map((item) => item.status), ["accepted", "rejected", "rejected"]);
  assert.match(audit.items.find((item) => item.id === "insecure").reason, /https/u);
  assert.match(audit.items.find((item) => item.id === "manual").reason, /WhatsApp/u);
});

test("promotion is no-loss, includes only accepted rows and is idempotent", () => {
  const { currentTargets, companyMap, companies, expectedProposal } = fixtures();
  const audit = createLandingTargetAudit({
    proposal: expectedProposal.document,
    proposalSha256: "proposal-hash",
    currentTargets,
    expectedProposal,
    companyMap,
    companies,
    sourceHashes: { canonicalTargets: "canonical-hash" },
    manualRejections: new Map([["manual", "Ruta puente de WhatsApp no durable"]]),
  });
  const promotion = prepareAuditedPromotion({
    proposal: expectedProposal.document,
    audit,
    currentTargets,
  });

  assert.equal(promotion.alreadyPromoted, false);
  assert.deepEqual(promotion.document.items.slice(0, 1), currentTargets.items);
  assert.deepEqual(promotion.document.items.map((item) => item.id), ["legacy", "accepted"]);
  const repeated = prepareAuditedPromotion({
    proposal: expectedProposal.document,
    audit,
    currentTargets: promotion.document,
  });
  assert.equal(repeated.alreadyPromoted, true);
});

test("a revised audit can safely reconcile only additions from the same hashed proposal", () => {
  const { currentTargets, companyMap, companies, expectedProposal } = fixtures();
  const firstAudit = createLandingTargetAudit({
    proposal: expectedProposal.document,
    proposalSha256: "proposal-hash",
    currentTargets,
    expectedProposal,
    companyMap,
    companies,
    sourceHashes: { canonicalTargets: "canonical-hash" },
    manualRejections: new Map([["manual", "Primera exclusión"]]),
  });
  const firstPromotion = prepareAuditedPromotion({
    proposal: expectedProposal.document,
    audit: firstAudit,
    currentTargets,
  }).document;
  const revisedAudit = createLandingTargetAudit({
    proposal: expectedProposal.document,
    proposalSha256: "proposal-hash",
    currentTargets,
    expectedProposal,
    companyMap,
    companies,
    sourceHashes: { canonicalTargets: "canonical-hash" },
    manualRejections: new Map([
      ["manual", "Primera exclusión"],
      ["accepted", "Revisión posterior"],
    ]),
    observedCanonical: firstPromotion,
    observedCanonicalSha256: "promoted-hash",
  });
  const reconciled = prepareAuditedPromotion({
    proposal: expectedProposal.document,
    audit: revisedAudit,
    currentTargets: firstPromotion,
  });

  assert.equal(reconciled.reconciling, true);
  assert.deepEqual(reconciled.document.items, currentTargets.items);
  assert.throws(
    () => prepareAuditedPromotion({
      proposal: expectedProposal.document,
      audit: revisedAudit,
      currentTargets: {
        ...firstPromotion,
        items: [...firstPromotion.items, { id: "foreign", url: "https://foreign.example/" }],
      },
    }),
    /cambió|ajenas/u,
  );
});

test("hash binding rejects a modified proposal or source", () => {
  const proposalRaw = "{\"items\":[]}";
  const hash = "eef46741adfc3a9f76294d3b78f37a45f113092ac9d44ee77c7a038a88ff09a1";
  const audit = {
    schema: "redvitalia-scrapecreators-landing-target-audit-v1",
    proposalSha256: hash,
    sourceHashes: { normalized: "n", canonicalTargets: "c" },
  };
  assert.equal(
    verifyHashBindings({
      audit,
      proposalRaw,
      currentSourceHashes: { normalized: "n", canonicalTargets: "c" },
    }),
    true,
  );
  assert.throws(
    () => verifyHashBindings({
      audit,
      proposalRaw: `${proposalRaw} `,
      currentSourceHashes: { normalized: "n", canonicalTargets: "c" },
    }),
    /Hash de propuesta/u,
  );
  assert.throws(
    () => verifyHashBindings({
      audit,
      proposalRaw,
      currentSourceHashes: { normalized: "changed", canonicalTargets: "c" },
    }),
    /normalized/u,
  );
});
