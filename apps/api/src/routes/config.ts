import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    authRequired: config.authRequired,
    maxApkMb: Math.round(config.maxApkBytes / (1024 * 1024)),
    maxConcurrentJobs: config.maxConcurrentJobs,
    maxQueueLength: config.maxQueueLength,
    jobTtlMinutes: Math.round(config.jobTtlMs / 60_000),
    version: config.version,
  });
});

export default router;
