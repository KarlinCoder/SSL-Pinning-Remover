import { existsSync } from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config.js';
import { requireAuth } from './auth.js';
import { JobManager } from './jobs/JobManager.js';
import { apiErrorBody } from './lib/errors.js';
import authRouter from './routes/auth.js';
import configRouter from './routes/config.js';
import { createJobsRouter } from './routes/jobs.js';

const app = express();
const manager = new JobManager();

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy ? 1 : false);
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
    ].join('; '),
  );
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    version: config.version,
    uptime: Math.round(process.uptime()),
    jobs: manager.stats(),
  });
});

app.use('/api/config', configRouter);
app.use('/api/auth', authRouter);
app.use('/api/jobs', requireAuth, createJobsRouter(manager));

app.use(
  express.static(config.webDist, {
    index: false,
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);

app.use((req, res, next) => {
  if (
    req.method !== 'GET' ||
    req.path === '/api' ||
    req.path.startsWith('/api/')
  ) {
    next();
    return;
  }

  const indexFile = path.join(config.webDist, 'index.html');
  if (!existsSync(indexFile)) {
    next();
    return;
  }

  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(indexFile);
});

app.use((req, res) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Ruta no encontrada.',
      },
    });
    return;
  }

  res.status(404).type('text/plain').send('Not found');
});

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      (error as { type?: string }).type === 'entity.too.large'
    ) {
      res.status(413).json({
        error: {
          code: 'TOO_LARGE',
          message: 'La solicitud es demasiado grande.',
        },
      });
      return;
    }

    if (
      error &&
      typeof error === 'object' &&
      'type' in error &&
      (error as { type?: string }).type === 'entity.parse.failed'
    ) {
      res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'El cuerpo de la solicitud no es JSON válido.',
        },
      });
      return;
    }

    const { status, body } = apiErrorBody(error);
    if (status >= 500) console.error('[api] error no controlado:', error);
    res.status(status).json(body);
  },
);

async function main(): Promise<void> {
  await manager.init();

  const server = app.listen(config.port, config.host, () => {
    console.log('');
    console.log('  APK HTTPS Lab');
    console.log(`  http://localhost:${config.port}`);
    console.log(`  Datos: ${config.dataDir}`);
    console.log('');

    if (!config.authRequired) {
      console.warn(
        '  [seguridad] APP_PASSWORD está vacío: el servicio no tiene login.',
      );
      console.warn(
        '  [seguridad] No expongas esto a Internet sin contraseña y HTTPS.',
      );
    }

    if (config.generatedSessionSecret) {
      console.warn(
        '  [auth] SESSION_SECRET no está configurado; se generó uno temporal.',
      );
      console.warn(
        '  [auth] Las sesiones se invalidarán cada vez que reinicies el contenedor.',
      );
    }
  });

  let closing = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    console.log(`[server] ${signal} recibido. Cerrando...`);

    await manager.shutdown();
    server.close(() => process.exit(0));

    const forceExit = setTimeout(() => process.exit(1), 5000);
    forceExit.unref();
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

main().catch((error) => {
  console.error('[server] no se pudo arrancar:', error);
  process.exit(1);
});
