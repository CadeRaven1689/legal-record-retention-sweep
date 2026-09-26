import { z } from "zod";

export const matterRecordSchema = z.object({
  matterId: z.string().min(1),
  stage: z.enum(["intake", "engaged", "closed"]),
  closedAt: z.string().datetime().nullable(),
  signedDocument: z.object({
    deliveredAt: z.string().datetime().nullable(),
    objectKey: z.string().min(1),
  }),
  deadlineFollowup: z.object({
    dueAt: z.string().datetime(),
    resolvedAt: z.string().datetime().nullable(),
  }),
});

export type MatterRecord = z.infer<typeof matterRecordSchema>;
export type RetentionDecision = {
  matterId: string;
  action: "retain" | "delete";
  reason: "active-matter" | "delivery-pending" | "followup-open" | "retention-expired" | "retention-window";
  objectKeys: string[];
};

const DAY_MS = 86_400_000;

export function decideMatterRetention(
  matter: MatterRecord,
  asOf: Date,
  retentionDays: number,
): RetentionDecision {
  const retain = (reason: RetentionDecision["reason"]): RetentionDecision => ({
    matterId: matter.matterId,
    action: "retain",
    reason,
    objectKeys: [],
  });

  if (matter.stage !== "closed" || !matter.closedAt) return retain("active-matter");
  if (!matter.signedDocument.deliveredAt) return retain("delivery-pending");
  if (!matter.deadlineFollowup.resolvedAt) return retain("followup-open");

  const cutoff = asOf.getTime() - retentionDays * DAY_MS;
  if (Date.parse(matter.closedAt) > cutoff) return retain("retention-window");

  return {
    matterId: matter.matterId,
    action: "delete",
    reason: "retention-expired",
    objectKeys: [matter.signedDocument.objectKey],
  };
}
