import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { AuthUser, UserTokenPayload } from '@pixelcraft/types';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../common/database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwtSecret =
      configService.get<string>('JWT_SECRET') ||
      'pixelcraft-pos-dev-secret-key-32chars!!';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: UserTokenPayload): Promise<AuthUser> {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid or malformed authentication token.');
    }

    // Check if token belongs to a Platform User (Super Admin)
    if (payload.isPlatformUser || payload.isSuperAdmin) {
      const platformUser = await this.prisma.platformUser.findUnique({
        where: { id: payload.sub },
      });

      if (!platformUser || !platformUser.isActive || platformUser.deletedAt) {
        throw new UnauthorizedException(
          'Platform administrator account is nonexistent, disabled, or deactivated.',
        );
      }

      return {
        id: platformUser.id,
        email: platformUser.email,
        fullName: 'PixelCraft Super Admin',
        phone: null,
        isActive: platformUser.isActive,
        isSuperAdmin: platformUser.role === 'SUPER_ADMIN',
        isPlatformUser: true,
        role: platformUser.role,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive || user.deletedAt) {
      // Fallback check in platformUser if not found in regular users table
      const platformUser = await this.prisma.platformUser.findUnique({
        where: { id: payload.sub },
      });

      if (platformUser && platformUser.isActive && !platformUser.deletedAt) {
        return {
          id: platformUser.id,
          email: platformUser.email,
          fullName: 'PixelCraft Super Admin',
          phone: null,
          isActive: platformUser.isActive,
          isSuperAdmin: platformUser.role === 'SUPER_ADMIN',
          isPlatformUser: true,
          role: platformUser.role,
        };
      }

      throw new UnauthorizedException(
        'User account associated with this token is nonexistent, disabled, or deactivated.',
      );
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive,
      isSuperAdmin: false,
      isPlatformUser: false,
    };
  }
}

