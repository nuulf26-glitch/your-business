import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Request } from 'express';
import { DbService } from './database';
import { SessionGuard } from './session';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,64}$/;
const clamp = (value: unknown, limit: number) => String(value ?? '').trim().slice(0, limit);
const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');

function ownerRecord(row: any) {
  const data = row?.data && typeof row.data === 'object' ? row.data : {};
  const { tokenHash: _tokenHash, ...publicData } = data;
  return { id: row.id, ...publicData, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

function parseContent(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 20) throw new BadRequestException('Protected content must contain up to 20 text blocks.');
  const content = value.map((item) => clamp(item, 5000));
  if (content.some((item) => !item)) throw new BadRequestException('Protected content blocks cannot be empty.');
  return content;
}

@Controller('memberships')
@UseGuards(SessionGuard)
export class MembershipsController {
  constructor(private readonly db: DbService) {}

  private async business(req: Request & { user: any }) {
    const selected = String(typeof req.get === 'function' ? req.get('x-cyb-business-id') || '' : '').trim();
    const business = await this.db.business.findFirst({
      where: { ownerId: req.user.id, ...(selected ? { id: selected } : {}) },
    });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  private async tier(businessId: string, id: string) {
    const row = await this.db.businessRecord.findFirst({ where: { id, businessId, type: 'membershipTier' } });
    if (!row) throw new NotFoundException('Membership tier not found');
    return row;
  }

  @Get('tiers')
  async listTiers(@Req() req: Request & { user: any }) {
    const business = await this.business(req);
    const rows = await this.db.businessRecord.findMany({
      where: { businessId: business.id, type: 'membershipTier' },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return rows.map(ownerRecord);
  }

  @Post('tiers')
  async createTier(@Req() req: Request & { user: any }, @Body() body: any) {
    const business = await this.business(req);
    const input = body?.data || {};
    const name = clamp(input.name, 100);
    const description = clamp(input.description, 1000);
    const protectedContent = parseContent(input.protectedContent) || [];
    if (!name) throw new BadRequestException('Tier name is required.');
    const existing = await this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'membershipTier' }, take: 200 });
    if (existing.some((row: any) => String(row.data?.name || '').toLowerCase() === name.toLowerCase())) {
      throw new ConflictException('A tier with this name already exists.');
    }
    const row = await this.db.businessRecord.create({
      data: {
        businessId: business.id,
        type: 'membershipTier',
        status: input.active === false ? 'inactive' : 'active',
        data: { name, description, protectedContent, accessMode: 'manual', createdAt: new Date().toISOString() },
      },
    });
    return ownerRecord(row);
  }

  @Patch('tiers/:id')
  async updateTier(@Req() req: Request & { user: any }, @Param('id') id: string, @Body() body: any) {
    const business = await this.business(req);
    const prior = await this.tier(business.id, id);
    const input = body?.data || {};
    const old = prior.data as Record<string, any>;
    const name = input.name === undefined ? old.name : clamp(input.name, 100);
    const description = input.description === undefined ? old.description : clamp(input.description, 1000);
    const protectedContent = parseContent(input.protectedContent) ?? old.protectedContent ?? [];
    if (!name) throw new BadRequestException('Tier name is required.');
    if (input.active !== undefined && typeof input.active !== 'boolean') throw new BadRequestException('Tier active state must be true or false.');
    const rows = await this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'membershipTier' }, take: 200 });
    if (rows.some((row: any) => row.id !== id && String(row.data?.name || '').toLowerCase() === String(name).toLowerCase())) {
      throw new ConflictException('A tier with this name already exists.');
    }
    const active = input.active === undefined ? prior.status === 'active' : input.active === true;
    const data = { ...old, name, description, protectedContent, updatedAt: new Date().toISOString() };
    const result = await this.db.businessRecord.updateMany({ where: { id, businessId: business.id, type: 'membershipTier' }, data: { status: active ? 'active' : 'inactive', data: data as any } });
    if (!result.count) throw new NotFoundException('Membership tier not found');
    return { id, ...data, status: active ? 'active' : 'inactive' };
  }

  @Get('entitlements')
  async listEntitlements(@Req() req: Request & { user: any }) {
    const business = await this.business(req);
    const [rows, tiers] = await Promise.all([
      this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'membershipEntitlement' }, orderBy: { createdAt: 'desc' }, take: 500 }),
      this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'membershipTier' }, take: 200 }),
    ]);
    const names = new Map(tiers.map((tier: any) => [tier.id, tier.data?.name || 'Membership tier']));
    return rows.map((row: any) => {
      const current = ownerRecord(row);
      const expired = current.status === 'active' && current.endsAt && Date.parse(current.endsAt) <= Date.now();
      return { ...current, status: expired ? 'expired' : current.status, tierName: names.get(row.data?.tierId) || 'Removed tier' };
    });
  }

  @Post('entitlements')
  async grantEntitlement(@Req() req: Request & { user: any }, @Body() body: any) {
    const business = await this.business(req);
    const input = body?.data || {};
    const tierId = clamp(input.tierId, 128);
    const name = clamp(input.name, 120);
    const email = clamp(input.email, 254).toLowerCase();
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !tierId) throw new BadRequestException('Add a member name, valid email, and tier.');
    let endsAt: string | null = null;
    if (input.endsAt) {
      const parsed = Date.parse(String(input.endsAt));
      if (!Number.isFinite(parsed) || parsed <= Date.now()) throw new BadRequestException('Access expiry must be a future date.');
      endsAt = new Date(parsed).toISOString();
    }
    const accessToken = randomBytes(32).toString('base64url');
    return this.db.$transaction(async (tx: any) => {
      // Keep duplicate detection and creation in one database transaction.
      // The transaction-scoped advisory lock serializes identical business /
      // tier / member-email grants across API instances without a migration.
      // Project a boolean rather than PostgreSQL's void return type, which
      // Prisma cannot deserialize from a raw query result.
      await tx.$queryRaw`WITH acquired AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${business.id}), hashtext(${'membership:' + tierId + ':' + email}))) SELECT TRUE FROM acquired`;
      const tier = await tx.businessRecord.findFirst({ where: { id: tierId, businessId: business.id, type: 'membershipTier' } });
      if (!tier) throw new NotFoundException('Membership tier not found');
      if (tier.status !== 'active') throw new BadRequestException('Activate this tier before granting access.');
      const entitlements = await tx.businessRecord.findMany({ where: { businessId: business.id, type: 'membershipEntitlement' }, take: 5000 });
      const hasActive = entitlements.some((row: any) => row.status === 'active' && String(row.data?.email || '').toLowerCase() === email && row.data?.tierId === tierId && (!row.data?.endsAt || Date.parse(row.data.endsAt) > Date.now()));
      if (hasActive) throw new ConflictException('This member already has active access to this tier.');
      const customer = await tx.customer.findFirst({ where: { businessId: business.id, data: { path: ['email'], equals: email } } });
      const now = new Date().toISOString();
      const row = await tx.businessRecord.create({
        data: {
          businessId: business.id,
          type: 'membershipEntitlement',
          status: 'active',
          data: {
            name,
            email,
            customerId: customer?.id || null,
            tierId,
            tokenHash: hashToken(accessToken),
            startsAt: now,
            endsAt,
            source: 'manual',
            grantedAt: now,
          } as any,
        },
      });
      return { ...ownerRecord(row), tierName: (tier.data as any).name, accessToken };
    });
  }

  @Patch('entitlements/:id/revoke')
  async revokeEntitlement(@Req() req: Request & { user: any }, @Param('id') id: string) {
    const business = await this.business(req);
    const row = await this.db.businessRecord.findFirst({ where: { id, businessId: business.id, type: 'membershipEntitlement' } });
    if (!row) throw new NotFoundException('Membership access not found');
    if (row.status === 'revoked') return ownerRecord(row);
    const data = { ...(row.data as any), revokedAt: new Date().toISOString() };
    await this.db.businessRecord.updateMany({ where: { id, businessId: business.id, type: 'membershipEntitlement', status: 'active' }, data: { status: 'revoked', data } });
    return { id, ...data, status: 'revoked' };
  }
}

@Controller('public/memberships')
export class PublicMembershipsController {
  constructor(private readonly db: DbService) {}

  @Post('access')
  async access(@Body() body: any) {
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!TOKEN_PATTERN.test(token)) throw new ForbiddenException('Membership access is unavailable.');
    const entitlement = await this.db.businessRecord.findFirst({
      where: { type: 'membershipEntitlement', data: { path: ['tokenHash'], equals: hashToken(token) } },
    });
    const now = Date.now();
    const data = entitlement?.data as any;
    if (!entitlement || entitlement.status !== 'active' || !data || Date.parse(data.startsAt) > now || (data.endsAt && Date.parse(data.endsAt) <= now)) {
      throw new ForbiddenException('Membership access is unavailable.');
    }
    const tier = await this.db.businessRecord.findFirst({ where: { id: data.tierId, businessId: entitlement.businessId, type: 'membershipTier', status: 'active' } });
    if (!tier) throw new ForbiddenException('Membership access is unavailable.');
    const business = await this.db.business.findUnique({ where: { id: entitlement.businessId }, select: { name: true } });
    const tierData = tier.data as any;
    return {
      businessName: business?.name || 'CYB business',
      tierName: tierData.name,
      description: tierData.description || '',
      content: Array.isArray(tierData.protectedContent) ? tierData.protectedContent : [],
      expiresAt: data.endsAt || null,
    };
  }
}
