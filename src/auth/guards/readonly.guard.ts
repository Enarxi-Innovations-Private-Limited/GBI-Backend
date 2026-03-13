import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { READONLY_BLOCKED_KEY } from '../decorators/readonly.decorator';

/**
 * ReadonlyGuard — rejects mutating requests when the authenticated
 * user is operating via an admin impersonation token (readonly: true).
 *
 * Apply this guard AFTER JwtAuthGuard so req.user is already populated.
 * Pair with the @ReadonlyBlocked() decorator on POST/PATCH/DELETE routes.
 */
@Injectable()
export class ReadonlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isBlocked = this.reflector.getAllAndOverride<boolean>(
      READONLY_BLOCKED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isBlocked) {
      return true; // Route is not marked as readonly-blocked — allow
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.readonly === true) {
      throw new ForbiddenException(
        'This action is not available in read-only view mode.',
      );
    }

    return true;
  }
}
