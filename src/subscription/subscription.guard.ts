import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    const isPremium = await this.subscriptionService.isPremium(user.id);

    if (!isPremium) {
      throw new ForbiddenException(
        'Premium subscription required. Upgrade to access this feature.',
      );
    }

    return true;
  }
}
