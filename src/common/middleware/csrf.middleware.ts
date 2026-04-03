import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    // 1. Parse cookies manually from headers
    // In NestJS Fastify middleware, req.cookies might not be populated yet by @fastify/cookie
    const cookies = this.parseCookies(req.headers?.cookie);
    let token = cookies['XSRF-TOKEN'];

    // 2. Generate new token if missing
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      const isProduction = process.env.NODE_ENV === 'production';

      const cookieOptions = [
        `XSRF-TOKEN=${token}`,
        'Path=/',
        'SameSite=Lax',
        `Max-Age=${3600 * 24}`,
      ];

      // Note: We MUST omit 'HttpOnly' so that client-side JS can read it.

      if (isProduction) {
        cookieOptions.push('Secure');
      }

      const newCookie = cookieOptions.join('; ');
      const existingSetCookie = res.getHeader('Set-Cookie');

      if (!existingSetCookie) {
        res.setHeader('Set-Cookie', newCookie);
      } else if (Array.isArray(existingSetCookie)) {
        res.setHeader('Set-Cookie', [...existingSetCookie, newCookie]);
      } else {
        res.setHeader('Set-Cookie', [existingSetCookie, newCookie]);
      }
    }

    // 3. Verify token for state-changing methods
    const method = req.method?.toUpperCase();
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

    // EXEMPT standard login/signup paths from CSRF check to prevent the first-hit 403.
    // At this stage, users have no valid session, so CSRF validation is not logically applicable.
    const url = req.url?.toLowerCase() || '';
    const isAuthPath =
      url.includes('/auth/login') ||
      url.includes('/auth/signup') ||
      url.includes('/admin/login') ||
      url.includes('/auth/verify-email-otp') ||
      url.includes('/auth/refresh-token');

    if (isAuthPath) {
      return next();
    }

    if (stateChangingMethods.includes(method)) {
      const headerToken = req.headers['x-xsrf-token'];
      const isPostman = req.headers['user-agent']
        ?.toLowerCase()
        .includes('postman');
      const isDev = process.env.NODE_ENV !== 'production';

      // Allow Postman bypass in development for easy testing
      if (isPostman && isDev) {
        return next();
      }

      if (!headerToken || headerToken !== token) {
        throw new ForbiddenException('Invalid or missing CSRF token');
      }
    }

    next();
  }

  private parseCookies(
    cookieHeader: string | undefined,
  ): Record<string, string> {
    const list: Record<string, string> = {};
    if (!cookieHeader) return list;

    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      const key = parts.shift()?.trim();
      if (key) {
        list[key] = decodeURIComponent(parts.join('='));
      }
    });

    return list;
  }
}
