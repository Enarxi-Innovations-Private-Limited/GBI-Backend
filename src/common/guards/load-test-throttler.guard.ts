import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class LoadTestThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const bypassKey = request.headers['x-load-test-bypass'];
    
    // Skip rate limiting if the secret key matches
    return !!bypassKey && bypassKey === process.env.LOAD_TEST_BYPASS_KEY;
  }
}