import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for @RequiresPremium() decorator.
 */
export const PREMIUM_KEY = 'requiresPremium';

/**
 * @RequiresPremium() — Marks an endpoint or controller as premium-only.
 *
 * Must be used together with PremiumGuard:
 *
 *   @UseGuards(JwtAuthGuard, PremiumGuard)
 *   @RequiresPremium()
 *   @Get('premium-endpoint')
 *   handler() { ... }
 *
 * The PremiumGuard reads this metadata to decide whether to enforce
 * the premium check.
 */
export const RequiresPremium = () => SetMetadata(PREMIUM_KEY, true);
