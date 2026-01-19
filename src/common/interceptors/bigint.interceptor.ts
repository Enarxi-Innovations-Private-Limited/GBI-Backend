import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { map } from 'rxjs/operators';

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((data) => {
        return JSON.parse(
          JSON.stringify(data, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value,
          ),
        );
      }),
    );
  }
}
