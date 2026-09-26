import { infrai } from "./infrai_client.js";

const task = process.env.LEGAL_SWEEP_URL;
if (!task) throw new Error("Set LEGAL_SWEEP_URL to the public sweep endpoint");

const schedule = await infrai.cron.create({
  cron_expr: "0 2 * * *",
  task,
});

console.log(JSON.stringify({ scheduled: true, jobId: schedule.job_id }));
