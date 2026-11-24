import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { AppError } from './lib/errors.js';

const COOKIE_NAME = 'apk_lab_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function sign(value: string): string {
  return createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

function createToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE_MS }),
    'utf8',
  ).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string | undefined): boolean {
  if (!token) return false;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  if (!safeEqual(signature, sign(payload))) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: unknown;
    };
    return typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export function isAuthenticated(req: Request): boolean {
  if (!config.authRequired) return true;
  return verifyToken(req.cookies?.[COOKIE_NAME]);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isAuthenticated(req)) {
    next();
    return;
  }

  res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Necesitas iniciar sesión para usar el laboratorio.',
    },
  });
}

export function login(password: string, res: Response): void {
  if (!config.authRequired) {
    res.json({ authenticated: true, authRequired: false });
    return;
  }

  if (!safeEqual(password, config.appPassword)) {
    throw new AppError('INVALID_PASSWORD', 401, 'Contraseña incorrecta.');
  }

  res.cookie(COOKIE_NAME, createToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });

  res.json({ authenticated: true, authRequired: true });
}

export function logout(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
  });
  res.json({ ok: true });
}

export function authState(req: Request): { authenticated: boolean; authRequired: boolean } {
  return {
    authenticated: isAuthenticated(req),
    authRequired: config.authRequired,
  };
}
