import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { DbService } from './database';
import { SessionGuard } from './session';

const clean = (value: unknown, limit: number) => String(value ?? '').trim().slice(0, limit);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const recordId = (prefix: string, value: string) => `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 48)}`;

type MarketingBusiness = { id: string; slug: string; settings?: unknown };

@Controller('marketing')
export class MarketingController {
  constructor(private readonly db: DbService) {}

  private async business(req: Request & { user: any }): Promise<MarketingBusiness> {
    const selected = clean(req.get('x-cyb-business-id'), 120);
    const business = await this.db.business.findFirst({ where: { ownerId: req.user.id, ...(selected ? { id: selected } : {}) } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  private businessSettings(business: MarketingBusiness): Record<string, any> {
    return business.settings && typeof business.settings === 'object' && !Array.isArray(business.settings)
      ? business.settings as Record<string, any>
      : {};
  }

  private async unsubscribeKey(business: MarketingBusiness): Promise<string> {
    const environmentKey = process.env.MARKETING_UNSUBSCRIBE_SECRET?.trim();
    if (environmentKey && environmentKey.length >= 32) return environmentKey;
    const settings = this.businessSettings(business);
    if (typeof settings.marketingUnsubscribeKey === 'string' && settings.marketingUnsubscribeKey.length >= 32) {
      return settings.marketingUnsubscribeKey;
    }
    const generated = randomBytes(32).toString('base64url');
    await this.db.business.update({
      where: { id: business.id },
      data: { settings: { ...settings, marketingUnsubscribeKey: generated } as any },
    });
    return generated;
  }

  private unsubscribeToken(secret: string, businessId: string, contactId: string): string {
    return createHmac('sha256', secret).update(`${businessId}:${contactId}`).digest('base64url');
  }

  private suppressionHash(secret: string, businessId: string, email: string): string {
    return createHmac('sha256', secret).update(`marketing-suppression:${businessId}:${email}`).digest('hex');
  }

  private safeContact(row: any, business: MarketingBusiness, secret: string) {
    const data = row.data as Record<string, any>;
    return {
      id: row.id,
      name: String(data.name || ''),
      email: String(data.email || ''),
      consentStatus: data.consentStatus,
      consentAt: data.consentAt || null,
      consentSource: data.consentSource || null,
      unsubscribedAt: data.unsubscribedAt || null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      businessSlug: business.slug,
      unsubscribeToken: this.unsubscribeToken(secret, business.id, row.id),
    };
  }

  private async retentionDays(business: MarketingBusiness): Promise<number> {
    const row = await this.db.businessRecord.findFirst({ where: { businessId: business.id, type: 'marketingSettings' } });
    const value = Number((row?.data as any)?.unsubscribedRetentionDays);
    return Number.isInteger(value) && value >= 30 && value <= 3650 ? value : 365;
  }

  /**
   * Expired opt-out records are reduced to a one-way email hash for one more
   * retention window. This stops an accidental re-import from restoring
   * consent while the tombstone is live, without retaining the contact's name.
   * Expired tombstones are purged on the next authenticated marketing request.
   */
  private async purgeExpired(business: MarketingBusiness, days: number) {
    const businessId = business.id;
    const secret = await this.unsubscribeKey(business);
    const now = Date.now();
    const cutoff = now - days * 86_400_000;
    const [contacts, suppressions] = await Promise.all([
      this.db.businessRecord.findMany({ where: { businessId, type: 'marketingContact' }, take: 5000 }),
      this.db.businessRecord.findMany({ where: { businessId, type: 'marketingSuppression' }, take: 5000 }),
    ]);
    for (const row of contacts) {
      const data = row.data as Record<string, any>;
      const optedOutAt = Date.parse(String(data.unsubscribedAt || ''));
      if (data.consentStatus !== 'unsubscribed' || !Number.isFinite(optedOutAt) || optedOutAt > cutoff) continue;
      const hashedEmail = this.suppressionHash(secret, businessId, String(data.email || '').trim().toLowerCase());
      const suppressionId = recordId('mkt_supp', `${businessId}:${hashedEmail}`);
      await this.db.businessRecord.createMany({
        data: [{
          id: suppressionId,
          businessId,
          type: 'marketingSuppression',
          status: 'active',
          data: { emailHash: hashedEmail, expiresAt: new Date(now + days * 86_400_000).toISOString() },
        }],
        skipDuplicates: true,
      });
      await this.db.businessRecord.deleteMany({ where: { id: row.id, businessId, type: 'marketingContact' } });
    }
    const expiredIds = suppressions
      .filter(row => Date.parse(String((row.data as any)?.expiresAt || '')) <= now)
      .map(row => row.id);
    for (const id of expiredIds) await this.db.businessRecord.deleteMany({ where: { id, businessId, type: 'marketingSuppression' } });
  }

  @Get('contacts')
  @UseGuards(SessionGuard)
  async contacts(@Req() req: Request & { user: any }) {
    const business = await this.business(req);
    const days = await this.retentionDays(business);
    await this.purgeExpired(business, days);
    const [rows, secret] = await Promise.all([
      this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'marketingContact' }, orderBy: { createdAt: 'desc' }, take: 5000 }),
      this.unsubscribeKey(business),
    ]);
    return rows.map(row => this.safeContact(row, business, secret));
  }

  @Post('contacts')
  @UseGuards(SessionGuard)
  async addContact(@Req() req: Request & { user: any }, @Body() body: any) {
    const business = await this.business(req);
    const data = body?.data || {};
    const name = clean(data.name, 120);
    const email = clean(data.email, 254).toLowerCase();
    const source = clean(data.consentSource, 300);
    if (!emailPattern.test(email)) throw new BadRequestException('Enter a valid email address');
    if (data.consented !== true || source.length < 8) {
      throw new BadRequestException('Record the contact’s explicit opt-in and where it was collected');
    }
    const days = await this.retentionDays(business);
    await this.purgeExpired(business, days);
    const secret = await this.unsubscribeKey(business);
    const emailHash = this.suppressionHash(secret, business.id, email);
    const suppressionId = recordId('mkt_supp', `${business.id}:${emailHash}`);
    const suppression = await this.db.businessRecord.findFirst({ where: { id: suppressionId, businessId: business.id, type: 'marketingSuppression' } });
    if (suppression && Date.parse(String((suppression.data as any)?.expiresAt || '')) > Date.now()) {
      throw new ConflictException('This address is suppressed by a recent unsubscribe and cannot be re-added yet');
    }
    if (suppression) await this.db.businessRecord.deleteMany({ where: { id: suppressionId, businessId: business.id, type: 'marketingSuppression' } });
    const id = recordId('mkt_contact', `${business.id}:${email}`);
    if (await this.db.businessRecord.findFirst({ where: { id, businessId: business.id, type: 'marketingContact' } })) {
      throw new ConflictException('This contact already exists. Use explicit re-consent to update an unsubscribed contact');
    }
    const now = new Date().toISOString();
    const row = await this.db.businessRecord.create({
      data: {
        id,
        businessId: business.id,
        type: 'marketingContact',
        status: 'active',
        data: {
          name,
          email,
          consentStatus: 'subscribed',
          consentAt: now,
          consentSource: source,
          consentHistory: [{ action: 'opt_in', at: now, source }],
          createdAt: now,
        },
      },
    });
    return this.safeContact(row, business, secret);
  }

  @Post('contacts/:id/consent')
  @UseGuards(SessionGuard)
  async reconsent(@Req() req: Request & { user: any }, @Param('id') id: string, @Body() body: any) {
    const business = await this.business(req);
    const data = body?.data || {};
    const evidence = clean(data.evidence, 500);
    if (data.consented !== true || evidence.length < 12) throw new BadRequestException('Explicit re-consent evidence is required');
    const row = await this.db.businessRecord.findFirst({ where: { id, businessId: business.id, type: 'marketingContact' } });
    if (!row) throw new NotFoundException('Marketing contact not found');
    const previous = row.data as Record<string, any>;
    const now = new Date().toISOString();
    const history = Array.isArray(previous.consentHistory) ? previous.consentHistory : [];
    const updated = {
      ...previous,
      consentStatus: 'subscribed',
      consentAt: now,
      consentSource: evidence,
      unsubscribedAt: null,
      consentHistory: [...history, { action: 're_opt_in', at: now, source: evidence }].slice(-30),
    };
    await this.db.businessRecord.updateMany({ where: { id, businessId: business.id, type: 'marketingContact' }, data: { status: 'active', data: updated as any } });
    const secret = await this.unsubscribeKey(business);
    return this.safeContact({ ...row, status: 'active', data: updated }, business, secret);
  }

  @Patch('contacts/:id/unsubscribe')
  @UseGuards(SessionGuard)
  async unsubscribeAsOwner(@Req() req: Request & { user: any }, @Param('id') id: string) {
    const business = await this.business(req);
    return this.applyUnsubscribe(business, id);
  }

  @Post('unsubscribe')
  async unsubscribePublic(@Body() body: any) {
    const data = body?.data || {};
    const slug = clean(data.businessSlug, 100);
    const id = clean(data.contactId, 120);
    const token = clean(data.token, 100);
    if (!slug || !id || !token) throw new BadRequestException('Invalid unsubscribe link');
    const business = await this.db.business.findUnique({ where: { slug } });
    if (!business) throw new NotFoundException('Unsubscribe link not found');
    const row = await this.db.businessRecord.findFirst({ where: { id, businessId: business.id, type: 'marketingContact' } });
    if (!row) throw new NotFoundException('Unsubscribe link not found');
    const secret = await this.unsubscribeKey(business);
    const expected = Buffer.from(this.unsubscribeToken(secret, business.id, id));
    const provided = Buffer.from(token);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) throw new NotFoundException('Unsubscribe link not found');
    return this.applyUnsubscribe(business, id);
  }

  private async applyUnsubscribe(business: MarketingBusiness, id: string) {
    const row = await this.db.businessRecord.findFirst({ where: { id, businessId: business.id, type: 'marketingContact' } });
    if (!row) throw new NotFoundException('Marketing contact not found');
    const previous = row.data as Record<string, any>;
    if (previous.consentStatus === 'unsubscribed') return { id, consentStatus: 'unsubscribed', unchanged: true };
    const now = new Date().toISOString();
    const history = Array.isArray(previous.consentHistory) ? previous.consentHistory : [];
    const updated = { ...previous, consentStatus: 'unsubscribed', unsubscribedAt: now, consentHistory: [...history, { action: 'unsubscribe', at: now }].slice(-30) };
    const result = await this.db.businessRecord.updateMany({ where: { id, businessId: business.id, type: 'marketingContact' }, data: { status: 'unsubscribed', data: updated as any } });
    if (!result.count) throw new NotFoundException('Marketing contact not found');
    return { id, consentStatus: 'unsubscribed', unchanged: false };
  }

  @Delete('contacts/:id')
  @UseGuards(SessionGuard)
  async deleteContact(@Req() req: Request & { user: any }, @Param('id') id: string) {
    const business = await this.business(req);
    const row = await this.db.businessRecord.findFirst({ where: { id, businessId: business.id, type: 'marketingContact' } });
    if (!row) throw new NotFoundException('Marketing contact not found');
    const data = row.data as Record<string, any>;
    if (data.consentStatus === 'unsubscribed') {
      const days = await this.retentionDays(business);
      const secret = await this.unsubscribeKey(business);
      const hashedEmail = this.suppressionHash(secret, business.id, String(data.email || '').trim().toLowerCase());
      const tombstoneId = recordId('mkt_supp', `${business.id}:${hashedEmail}`);
      await this.db.businessRecord.createMany({
        data: [{ id: tombstoneId, businessId: business.id, type: 'marketingSuppression', status: 'active', data: { emailHash: hashedEmail, expiresAt: new Date(Date.now() + days * 86_400_000).toISOString() } }],
        skipDuplicates: true,
      });
    }
    const result = await this.db.businessRecord.deleteMany({ where: { id, businessId: business.id, type: 'marketingContact' } });
    if (!result.count) throw new NotFoundException('Marketing contact not found');
    return { deleted: true };
  }

  @Get('settings')
  @UseGuards(SessionGuard)
  async getSettings(@Req() req: Request & { user: any }) {
    const business = await this.business(req);
    const row = await this.db.businessRecord.findFirst({ where: { businessId: business.id, type: 'marketingSettings' } });
    const value = Number((row?.data as any)?.unsubscribedRetentionDays);
    return { unsubscribedRetentionDays: Number.isInteger(value) && value >= 30 && value <= 3650 ? value : 365 };
  }

  @Patch('settings')
  @UseGuards(SessionGuard)
  async updateSettings(@Req() req: Request & { user: any }, @Body() body: any) {
    const business = await this.business(req);
    const days = Number(body?.data?.unsubscribedRetentionDays);
    if (!Number.isInteger(days) || days < 30 || days > 3650) throw new BadRequestException('Retention must be between 30 and 3650 days');
    const current = await this.db.businessRecord.findFirst({ where: { businessId: business.id, type: 'marketingSettings' } });
    if (current) {
      const result = await this.db.businessRecord.updateMany({ where: { id: current.id, businessId: business.id, type: 'marketingSettings' }, data: { data: { unsubscribedRetentionDays: days } as any } });
      if (!result.count) throw new ConflictException('Marketing settings changed; reload and try again');
    } else {
      await this.db.businessRecord.create({ data: { businessId: business.id, type: 'marketingSettings', data: { unsubscribedRetentionDays: days } as any } });
    }
    await this.purgeExpired(business, days);
    return { unsubscribedRetentionDays: days };
  }

  @Get('campaigns')
  @UseGuards(SessionGuard)
  async campaigns(@Req() req: Request & { user: any }) {
    const business = await this.business(req);
    return this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'marketingCampaign' }, orderBy: { updatedAt: 'desc' }, take: 500 })
      .then(rows => rows.map(row => ({ id: row.id, ...row.data as object, status: row.status, updatedAt: row.updatedAt })));
  }

  @Post('campaigns')
  @UseGuards(SessionGuard)
  async createCampaign(@Req() req: Request & { user: any }, @Body() body: any) {
    const business = await this.business(req);
    const data = body?.data || {};
    const name = clean(data.name, 120);
    const subject = clean(data.subject, 180);
    const content = clean(data.content, 10000);
    if (!name || !subject || content.length < 1) throw new BadRequestException('Campaign name, subject and message are required');
    const now = new Date().toISOString();
    const row = await this.db.businessRecord.create({
      data: {
        businessId: business.id,
        type: 'marketingCampaign',
        status: 'draft',
        data: { name, subject, content, audience: 'all_subscribed', status: 'draft', createdAt: now, updatedAt: now } as any,
      },
    });
    return { id: row.id, ...row.data as object, status: row.status };
  }

  @Post('campaigns/:id/queue')
  @UseGuards(SessionGuard)
  async queueCampaign(@Req() req: Request & { user: any }, @Param('id') id: string) {
    const business = await this.business(req);
    const row = await this.db.businessRecord.findFirst({ where: { id, businessId: business.id, type: 'marketingCampaign' } });
    if (!row) throw new NotFoundException('Campaign not found');
    if (row.status !== 'draft') throw new ConflictException('Only draft campaigns can be queued');
    if (!String((row.data as any)?.content || '').includes('{{unsubscribe_url}}')) {
      throw new BadRequestException('Add the {{unsubscribe_url}} placeholder before queueing');
    }
    const [contacts, unsubscribedRetentionDays] = await Promise.all([
      this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'marketingContact' }, take: 5000 }),
      this.retentionDays(business),
    ]);
    await this.purgeExpired(business, unsubscribedRetentionDays);
    const eligible = contacts.filter(contact => {
      const data = contact.data as any;
      return contact.status === 'active' && data.consentStatus === 'subscribed' && emailPattern.test(String(data.email || ''));
    });
    if (!eligible.length) throw new BadRequestException('There are no opted-in contacts for this campaign');
    const now = new Date().toISOString();
    const campaign = row.data as Record<string, any>;
    const updated = { ...campaign, status: 'queued', queuedAt: now, eligibleCount: eligible.length, lastConsentCheckAt: now, suppressionPolicy: 'recheck consent before any dispatch' };
    const result = await this.db.businessRecord.updateMany({ where: { id, businessId: business.id, type: 'marketingCampaign', status: 'draft' }, data: { status: 'queued', data: updated as any } });
    if (!result.count) throw new ConflictException('Campaign changed; reload and try again');
    // “Queued” is an internal planning state only. This platform deliberately
    // has no provider dispatch or scheduled external messaging in this feature.
    return { id, status: 'queued', eligibleCount: eligible.length, queuedAt: now };
  }

  @Delete('campaigns/:id')
  @UseGuards(SessionGuard)
  async deleteCampaign(@Req() req: Request & { user: any }, @Param('id') id: string) {
    const business = await this.business(req);
    const result = await this.db.businessRecord.deleteMany({ where: { id, businessId: business.id, type: 'marketingCampaign', status: 'draft' } });
    if (!result.count) throw new NotFoundException('Draft campaign not found');
    return { deleted: true };
  }
}
