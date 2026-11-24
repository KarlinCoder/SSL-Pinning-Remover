import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authState, login, logout } from '../auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Demasiados intentos de acceso. Espera unos minutos.',
    },
  },
});

const loginSchema = z.object({
  password: z.string().min(1).max(512),
});

router.get('/me', (req, res) => {
  res.json(authState(req));
});

router.post('/login', loginLimiter, (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('INVALID_REQUEST', 400, 'Falta la contraseña.');
    }

    login(parsed.data.password, res);
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (_req, res) => {
  logout(res);
});

export default router;
