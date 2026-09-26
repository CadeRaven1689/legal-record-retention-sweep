import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { ZodError, z } from "zod";
import { exampleMatters } from "./example_matters.js";
import { InfraiError, infrai } from "./infrai_client.js";
import { decideMatterRetention, matterRecordSchema } from "./matter_retention.js";

const bucket = process.env.LEGAL_RECORD_BUCKET ?? "legal-record-retention";
const port = Number(process.env.PORT ?? 3000);

export const sweepRequestSchema = z.object({
  asOf: z.string().datetime().optional(),
  retentionDays: z.number().int().min(1).max(3650).default(90),
  dryRun: z.boolean().default(false),
  matters: z.array(matterRecordSchema).min(1).max(500).optional(),
});

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function runLegalSweep(raw: unknown) {
  const input = sweepRequestSchema.parse(raw);
  const asOf = input.asOf ?? new Date().toISOString();
  const decisions = (input.matters ?? exampleMatters).map((matter) =>
    decideMatterRetention(matter, new Date(asOf), input.retentionDays),
  );
  const keys = [...new Set(decisions.flatMap((decision) => decision.objectKeys))].sort();

  if (!input.dryRun && keys.length > 0) {
    const fingerprint = createHash("sha256")
      .update(`${asOf.slice(0, 10)}:${keys.join("|")}`)
      .digest("hex");
    await infrai.storage.object.delete_batch(bucket, {
      keys,
      idempotency_key: `legal-sweep-${fingerprint}`,
    });
  }

  return {
    evaluated: decisions.length,
    selectedForDeletion: keys.length,
    deletionApplied: !input.dryRun && keys.length > 0,
    decisions,
  };
}

await infrai.storage.bucket.create({ name: bucket });

createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/legal-records/sweep") {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "route_not_found" }));
    return;
  }

  try {
    const result = await runLegalSweep(await readJson(request));
    response.statusCode = 200;
    response.end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: "invalid_request" }));
      return;
    }
    if (error instanceof InfraiError) {
      response.statusCode = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.end(JSON.stringify({ error: error.code }));
      return;
    }
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "sweep_failed" }));
  }
}).listen(port, () => {
  console.log(`Legal cleanup listening on http://localhost:${port}/legal-records/sweep`);
});
