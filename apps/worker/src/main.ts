/**
 * InfluenceHub worker entrypoint. The domain services live in the API package; this process runs
 * them without HTTP: BullMQ workers (social-sync, grading, maintenance) + repeatable schedulers.
 * Scale horizontally — jobs are idempotent and schedulers are upserted.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { startWorker } = require('@influencehub/api/dist/worker');

startWorker().catch((e: Error) => {
  // eslint-disable-next-line no-console
  console.error('Worker failed to start', e);
  process.exit(1);
});
