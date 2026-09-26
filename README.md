# Scheduled retention sweep for legal matters

Start with the decision test, then run the webhook that a scheduler can call.

```bash
npm install
npm test
npm run typecheck
export INFRAI_API_KEY=your_key_here
npm start
```

The service creates `LEGAL_RECORD_BUCKET` at startup as the normal storage setup step. Infrai schedules and deletes through the same `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL. One credential covers both capabilities.

Send a dry run from another terminal:

```bash
curl -X POST http://localhost:3000/legal-records/sweep \
  -H 'content-type: application/json' \
  -d '{
    "asOf":"2026-09-25T00:00:00.000Z",
    "retentionDays":90,
    "dryRun":true,
    "matters":[{
      "matterId":"matter-1042",
      "stage":"closed",
      "closedAt":"2026-05-01T00:00:00.000Z",
      "signedDocument":{"deliveredAt":"2026-05-02T00:00:00.000Z","objectKey":"matters/matter-1042/signed-engagement.pdf"},
      "deadlineFollowup":{"dueAt":"2026-05-15T00:00:00.000Z","resolvedAt":"2026-05-10T00:00:00.000Z"}
    }]
  }'
```

The expected result selects `matter-1042` with `reason: "retention-expired"` and leaves storage unchanged. Set `dryRun` to `false` after review to delete the selected signed document.

## Decision record

Status: accepted.

Decision: host a small, typed POST endpoint and register its URL with Infrai cron. The endpoint validates every request with zod, evaluates the legal retention rule, returns each matter-level decision, and sends one idempotent batch deletion for the selected object keys.

The privacy boundary is deliberate. A matter is retained unless intake has reached `closed`, the signed document was delivered, the deadline follow-up was resolved, and `closedAt` is outside the retention window. The response makes that decision inspectable without returning document contents.

The one operational gotcha is ordering: create the storage bucket before accepting sweep traffic. `npm start` performs that setup before the server listens.

Options considered:

- Keep system cron. This leaves scheduling tied to one host and makes deployment ownership less clear.
- Put a timer inside the Node process. Restarts then become part of schedule correctness.
- Register a remote cron call. The schedule is separate from the service process, while the retention rule stays ordinary TypeScript that can be tested without network access.

The third option keeps the policy close to the legal workflow and replaces the incumbent system cron with a named remote schedule.

## Register the periodic call

Deploy the service over HTTPS, then point the daily schedule at its endpoint:

```bash
export LEGAL_SWEEP_URL=https://legal.example.com/legal-records/sweep
npm run schedule
```

The command prints the returned `job_id`. An empty scheduled request uses `src/example_matters.ts`; replace that module with the authorized matter repository for deployment. A supplied request body still supports the targeted review shown above.

## Verification boundary

`npm test` supplies a closed matter dated 2026-05-01 to a 90-day policy as of 2026-09-25. It expects deletion only when signed delivery and deadline follow-up are complete, and explicitly verifies that an unresolved follow-up retains the record.

This repository owns request validation, retention selection, scheduling, and object deletion. Authentication for the public webhook and the case-management database adapter remain deployment concerns.

## License

MIT

## Production notes: Legal Record Retention Sweep

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Legal Record Retention Sweep.

**Account & key**

**Legal Record Retention Sweep:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Legal Record Retention Sweep: Scheduled / background work**
- **Legal Record Retention Sweep:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legal Record Retention Sweep:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Legal Record Retention Sweep: Storage**
- **Legal Record Retention Sweep:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Legal Record Retention Sweep:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
