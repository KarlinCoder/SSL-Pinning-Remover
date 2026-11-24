import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import type { JobManager } from '../jobs/JobManager.js';
import { AppError } from '../lib/errors.js';
import { sanitizeFilename } from '../lib/utils.js';

const ALLOWED_EXTENSIONS = ['.apk', '.xapk', '.apks', '.zip'];
const MAX_FILE_SIZE = config.maxApkBytes;

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new AppError('INVALID_FILE_TYPE', 400, 'Tipo de archivo no permitido. Solo .apk, .xapk, .apks o .zip'));
    }
  },
});

export function createUploadRouter(manager: JobManager): Router {
  const router = Router();

  router.post('/', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('NO_FILE', 400, 'No se ha enviado ningún archivo.');
      }

      const originalName = req.file.originalname;
      const safeName = sanitizeFilename(originalName, 'upload');
      const ext = path.extname(safeName).toLowerCase();

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new AppError('INVALID_FILE_TYPE', 400, 'Tipo de archivo no permitido. Solo .apk, .xapk, .apks o .zip');
      }

      const job = manager.create(`upload://${safeName}`);
      job.sourceFilename = safeName;

      const inputPath = path.join(job.jobDir, `input${ext}`);
      await fs.writeFile(inputPath, req.file.buffer);
      job.inputPath = inputPath;

      job.log('success', `Archivo subido: ${safeName} (${req.file.size} bytes).`);
      job.setStatus('inspecting', 'inspect', 18);

      res.status(202).json(job.snapshot(false));
    } catch (error) {
      next(error);
    }
  });

  return router;
}