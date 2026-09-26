import assert from "node:assert/strict";
import test from "node:test";
import { decideMatterRetention, type MatterRecord } from "../src/matter_retention.js";

const asOf = new Date("2026-09-25T00:00:00.000Z");

function closedMatter(overrides: Partial<MatterRecord> = {}): MatterRecord {
  return {
    matterId: "matter-1042",
    stage: "closed",
    closedAt: "2026-05-01T00:00:00.000Z",
    signedDocument: {
      deliveredAt: "2026-05-02T00:00:00.000Z",
      objectKey: "matters/matter-1042/signed-engagement.pdf",
    },
    deadlineFollowup: {
      dueAt: "2026-05-15T00:00:00.000Z",
      resolvedAt: "2026-05-10T00:00:00.000Z",
    },
    ...overrides,
  };
}

test("deletes only a closed matter after delivery, follow-up, and retention", () => {
  assert.deepEqual(decideMatterRetention(closedMatter(), asOf, 90), {
    matterId: "matter-1042",
    action: "delete",
    reason: "retention-expired",
    objectKeys: ["matters/matter-1042/signed-engagement.pdf"],
  });

  assert.equal(
    decideMatterRetention(
      closedMatter({ deadlineFollowup: { dueAt: "2026-05-15T00:00:00.000Z", resolvedAt: null } }),
      asOf,
      90,
    ).reason,
    "followup-open",
  );
});
