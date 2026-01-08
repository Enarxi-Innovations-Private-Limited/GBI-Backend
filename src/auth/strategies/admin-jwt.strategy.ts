import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(config: ConfigService) {
    console.log('ADMIN SECRET:', config.get('ADMIN_JWT_SECRET'));
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('ADMIN_JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    if (payload.type !== 'admin') {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
