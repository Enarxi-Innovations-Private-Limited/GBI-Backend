import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  async canActivate(context: ExecutionContext) {
    const response = context.switchToHttp().getResponse();

    // Polyfill res.setHeader for Passport compatibility
    if (!response.setHeader) {
      response.setHeader = (key: string, value: string) => {
        return response.header(key, value);
      };
    }

    // Polyfill res.end
    if (!response.end) {
      response.end = (payload: any) => {
        return response.send(payload);
      };
    }

    // Polyfill res.redirect
    if (!response.redirect) {
        // Fastify already has redirect, but we might need to mask it if Passport checks for property existence distinct from prototype?
        // Actually Fastify has reply.redirect. Passport calls it.
        // But to be safe, we ensure strict signature match if needed.
        // Usually, Fastify's redirect is compatible. The main issue is setHeader.
    } 
    // Double check redirect: Passport does res.setHeader('Location', url); res.statusCode = 302; res.end(); OR res.redirect(url)
    // The error was setHeader, so fixing setHeader is P1.

    return super.canActivate(context) as boolean | Promise<boolean>;
  }
}
