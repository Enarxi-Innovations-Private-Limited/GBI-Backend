import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PREMIUM_KEY } from 'src/auth/decorators/premium.decorator';

/**
 * PremiumGuard — Server-side enforcement for premium-only endpoints.
 *
 * SECURITY: Even if the frontend hides UI elements behind a premium check,
 * hackers can call the API directly. This guard ensures the backend rejects
 * requests from non-premium users for premium-protected endpoints.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, PremiumGuard)
 *   @RequiresPremium()
 *   @Get('some-premium-endpoint')
 *
 * The guard checks:
 *   1. req.user.isPremium must be true
 *   2. req.user.premiumExpiry must be in the future (not expired)
 *
 * This prevents:
 *   - Direct API calls bypassing the frontend
 *   - Expired subscriptions that haven't been cleaned up yet
 *   - Token replay from when the user was premium
 */
@Injectable()
export class PremiumGuard implements CanActivate {
  private readonly logger = new Logger(PremiumGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if the handler/class is decorated with @RequiresPremium()
    const requiresPremium = this.reflector.getAllAndOverride<boolean>(
      PREMIUM_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no @RequiresPremium() decorator, allow through
    if (!requiresPremium) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check isPremium flag
    if (!user.isPremium) {
      this.logger.warn(
        `Premium access denied for user ${user.id} (${user.email}) — not premium`,
      );
      throw new ForbiddenException(
        'This feature requires a Premium subscription. Please upgrade your plan.',
      );
    }

    // Double-check expiry hasn't passed (defense-in-depth)
    if (user.premiumExpiry && new Date(user.premiumExpiry) < new Date()) {
      this.logger.warn(
        `Premium access denied for user ${user.id} (${user.email}) — subscription expired`,
      );
      throw new ForbiddenException(
        'Your Premium subscription has expired. Please renew to continue using this feature.',
      );
    }

    return true;
  }
}
