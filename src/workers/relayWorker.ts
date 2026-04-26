import { createRelayWorker } from "../queues/relayQueue.js";

const worker = createRelayWorker();

if (!worker) {
  console.error("Relay worker not started: REDIS_URL is not configured.");
  process.exit(1);
}

console.log("Relay worker started.");

worker.on("completed", (job) => {
  console.log(`Relay job completed: ${job.name} (${job.id})`);
});

worker.on("failed", (job, error) => {
  console.error(`Relay job failed: ${job?.name ?? "unknown"} (${job?.id ?? "n/a"})`, error);
});

process.on("SIGINT", async () => {
  await worker.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
