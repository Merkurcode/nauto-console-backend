import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { IJwtPayload } from '@application/dtos/responses/user.response';
import { USER_REPOSITORY } from '@shared/constants/tokens';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: IJwtPayload): Promise<IJwtPayload> {
    console.log('DEBUG: JWT Strategy received payload:', payload);
    console.log('DEBUG: Session token (jti) in payload:', payload.jti);

    // Check if the user still exists
    const user = await this.userRepository.findById(payload.sub);

    // If a user is not found or not active, throw an UnauthorizedException
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User no longer active or not found');
    }

    // Return the payload with roles, permissions, tenant info, and session token which will be injected into the request object
    const result = {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      tenantId: payload.tenantId,
      companyId: payload.companyId,
      jti: payload.jti, // Include session token from JWT
    };

    console.log('DEBUG: JWT Strategy returning:', result);

    return result;
  }
}
