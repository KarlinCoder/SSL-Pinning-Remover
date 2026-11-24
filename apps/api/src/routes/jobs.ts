import { promises as fs } from 'node:fs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import type { Job } from '../jobs/Job.js';
import type { JobManager } from '../jobs/JobManager.js';
import { validateTargetUrl } from '../lib/download.js';
import { AppError } from '../lib/errors.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createSchema = z.object({
  url: z.string().trim().min(8).max(4096),
});

function getJobOrThrow(id: string, manager: JobManager): Job {
  if (!UUID_PATTERN.test(id)) {
    throw new AppError('NOT_FOUND', 404, 'Trabajo no encontrado.');
  }

  const job = manager.get(id);
  if (!job) {
    throw new AppError(
      'NOT_FOUND',
      404,
      'Trabajo no encontrado o ya eliminado.',
    );
  }

  return job;
}

export function createJobsRouter(manager: JobManager): Router {
  const router = Router();

  const createLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Demasiadas solicitudes. Espera unos minutos.',
      },
    },
  });

  router.post('/', createLimiter, async (req, res, next) => {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          'INVALID_REQUEST',
          400,
          'Envía un enlace válido en el campo "url".',
        );
      }

      await validateTargetUrl(parsed.data.url, {
        allowPrivateUrls: config.allowPrivateUrls,
        allowedPorts: config.allowedPorts,
      });

      const job = manager.create(parsed.data.url);
      res.status(202).json(job.snapshot(false));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', (req, res, next) => {
    try {
      const job = getJobOrThrow(req.params.id, manager);
      res.json(job.snapshot(true));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/events', (req, res, next) => {
    try {
      const job = getJobOrThrow(req.params.id, manager);
      job.attachSse(res);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/download', async (req, res, next) => {
    try {
      const job = getJobOrThrow(req.params.id, manager);

      if (job.status !== 'completed' || !job.artifact || !job.outputPath) {
        throw new AppError(
          'NOT_READY',
          409,
          'La APK todavía no está lista para descargar.',
        );
      }

      if (job.expiresAt && job.expiresAt.getTime() < Date.now()) {
        job.expire();
        throw new AppError(
          'EXPIRED',
          410,
          'El enlace de descarga expiró.',
          'Vuelve a preparar la APK para generar un archivo nuevo.',
        );
      }

      const outputPath = job.outputPath;
      const downloadName = job.artifact.filename;

      try {
        await fs.access(outputPath);
      } catch {
        throw new AppError(
          'FILE_NOT_FOUND',
          410,
          'El archivo ya no está disponible en el servidor.',
        );
      }

      res.setHeader('Cache-Control', 'no-store');
      res.download(outputPath, downloadName, (error) => {
        if (error && !res.headersSent) next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/cancel', (req, res, next) => {
    try {
      const job = manager.cancel(req.params.id);
      if (!job) {
        throw new AppError('NOT_FOUND', 404, 'Trabajo no encontrado.');
      }

      res.status(202).json({ ok: true, job: job.snapshot(false) });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', (req, res, next) => {
    try {
      if (!manager.remove(req.params.id)) {
        throw new AppError('NOT_FOUND', 404, 'Trabajo no encontrado.');
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
