import type { MatterRecord } from "./matter_retention.js";

// Replace this source with an authorized matter repository in deployment.
export const exampleMatters: MatterRecord[] = [
  {
    matterId: "matter-example-closed",
    stage: "closed",
    closedAt: "2025-01-10T00:00:00.000Z",
    signedDocument: {
      deliveredAt: "2025-01-11T00:00:00.000Z",
      objectKey: "matters/matter-example-closed/signed-engagement.pdf",
    },
    deadlineFollowup: {
      dueAt: "2025-01-20T00:00:00.000Z",
      resolvedAt: "2025-01-18T00:00:00.000Z",
    },
  },
];
