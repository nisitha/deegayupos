import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 },
      );
    }

    // 1. Look up user with active business memberships
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { status: 'ACTIVE', deletedAt: null },
          include: {
            business: true,
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 },
      );
    }

    // 2. Compare password with stored bcrypt hash
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 },
      );
    }

    // 3. Resolve active tenant
    const membership = user.memberships[0];
    const activeTenant = membership
      ? {
          id: membership.business.id,
          name: membership.business.name,
          slug: membership.business.slug,
          businessType: membership.business.businessType,
          currency: membership.business.currency,
          role: membership.role.code,
          roleId: membership.roleId,
          status: membership.status,
          isPrimaryBranchId: membership.defaultBranchId,
        }
      : null;

    const permissions = membership
      ? membership.role.permissions.map((rp) => rp.permission.code)
      : ['*'];

    // Generate session token
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: activeTenant?.role || 'OWNER',
      tenantId: activeTenant?.id,
    };
    const accessToken = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
    const refreshToken = Buffer.from(JSON.stringify({ sub: user.id, ts: Date.now() })).toString('base64');

    return NextResponse.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: 86400,
        tokenType: 'Bearer',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          isActive: user.isActive,
          role: activeTenant?.role || 'OWNER',
        },
        activeTenant,
        permissions,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    console.error('Login error in route handler:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
