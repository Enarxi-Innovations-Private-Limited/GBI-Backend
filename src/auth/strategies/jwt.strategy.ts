import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';

/**
 * JWT Strategy — Extracts token from HttpOnly cookie first,
 * falls back to Authorization: Bearer header for backward compatibility.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Try HttpOnly cookie first (primary, secure method)
        (req) => {
          if (req && req.cookies) {
            return req.cookies['accessToken'] || null;
          }
          return null;
        },
        // 2. Fallback to Authorization: Bearer header (backward compat)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Validate user exists and is not restricted
    const user = await this.authService.validateUser(payload.sub);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
