import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    // Bypass for load testing via secret header
    const bypassKey = request.headers['x-load-test-bypass'];
    if (bypassKey && bypassKey === process.env.LOAD_TEST_BYPASS_KEY) {
      // Mock a user object so that @CurrentUser() works in controllers
      request.user = { id: 'load-test-user', email: 'loadtest@gbi.com', role: 'ADMIN' };
      return true;
    }

    return super.canActivate(context);
  }
}
