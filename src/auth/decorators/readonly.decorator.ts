import { SetMetadata } from '@nestjs/common';

/**
 * Mark a route as read-only blocked.
 * When applied, the ReadonlyGuard will reject requests made with
 * an impersonation token (readonly: true).
 */
export const READONLY_BLOCKED_KEY = 'readonly_blocked';
export const ReadonlyBlocked = () => SetMetadata(READONLY_BLOCKED_KEY, true);
