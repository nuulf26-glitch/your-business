import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsObject } from 'class-validator';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { DbService } from './database';
import { SessionGuard } from './session';
import { appendSupportNote, parsePublicSupportSubmission, supportRecordId, supportRequestHash, updateSupportConversation } from './support-inbox-policy';

class SupportDataInput { @IsObject() data!: Record<string, unknown>; }

@Controller('public/support')
export class PublicSupportController {
  constructor(private readonly db: DbService) {}

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const data = body?.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data as Record<string, unknown> : body;
    let submission;
    try { submission = parsePublicSupportSubmission(data); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Check your request and try again.'); }
    const storeUrl = typeof data.storeUrl === 'string' ? data.storeUrl.trim().slice(0, 100) : '';
    if (!storeUrl) throw new BadRequestException('This support link is invalid.');
    const business = await this.db.business.findUnique({ where: { slug: storeUrl }, include: { website: true } });
    if (!business?.website?.published) throw new NotFoundException('Support page not found.');
    const id = supportRecordId(business.id, submission.requestId);
    const requestHash = supportRequestHash(submission);
    const existing = await this.db.businessRecord.findUnique({ where: { id } });
    if (existing) {
      if ((existing.data as any)?.requestHash !== requestHash) throw new ConflictException('This request key was already used. Refresh the page and try again.');
      return { id, duplicate: true };
    }

    const now = new Date().toISOString();
    const recordData = {
      subject: submission.subject,
      name: submission.name,
      email: submission.email,
      status: 'open',
      channel: 'website',
      messages: [{ id: `message_${id}`, kind: 'customer_message', body: submission.message, at: now }],
      assignedToUserId: null,
      requiresHuman: submission.needsHuman,
      handoffReason: submission.needsHuman ? 'Customer requested a person.' : null,
      requestHash,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
    };
    try {
      const created = await this.db.$transaction(async (tx: any) => {
        const row = await tx.businessRecord.create({ data: { id, businessId: business.id, type: 'supportConversation', status: 'open', data: recordData as any } });
        await tx.businessRecord.create({ data: { businessId: business.id, type: 'notifications', data: { type: 'support', recordId: id, message: 'New website support request' } as any } });
        return row;
      });
      return { id: created.id, duplicate: false };
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      const concurrent = await this.db.businessRecord.findUnique({ where: { id } });
      if (!concurrent) throw error;
      if ((concurrent.data as any)?.requestHash !== requestHash) throw new ConflictException('This request key was already used. Refresh the page and try again.');
      return { id, duplicate: true };
    }
  }
}

@Controller('support/inbox')
@UseGuards(SessionGuard)
export class SupportInboxController {
  constructor(private readonly db: DbService) {}

  private async business(req: Request & { user: any }) {
    const header = typeof req.get === 'function' ? req.get('x-cyb-business-id') : (req.headers as any)?.['x-cyb-business-id'];
    const id = String(header || '').trim();
    const business = await this.db.business.findFirst({ where: id ? { id, ownerId: req.user.id } : { ownerId: req.user.id } });
    if (!business) throw new NotFoundException('Business not found.');
    return business;
  }

  @Get()
  async list(@Req() req: Request & { user: any }, @Query() query: Record<string, string>) {
    const business = await this.business(req);
    const status = ['open', 'in_progress', 'waiting', 'closed'].includes(query.status) ? query.status : undefined;
    const rows = await this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'supportConversation', ...(status ? { status } : {}) }, orderBy: { updatedAt: 'desc' }, take: 300 });
    const search = String(query.search || '').trim().toLowerCase().slice(0, 100);
    return rows.filter((row: any) => {
      const data = row.data as any;
      return (!search || [data.subject, data.name, data.email].some((value) => String(value || '').toLowerCase().includes(search)))
        && (query.handoff !== 'true' || data.requiresHuman === true);
    }).map((row: any) => ({ id: row.id, subject: (row.data as any).subject, customerName: (row.data as any).name, status: row.status, channel: (row.data as any).channel, requiresHuman: (row.data as any).requiresHuman === true, assignedToUserId: (row.data as any).assignedToUserId || null, createdAt: row.createdAt, updatedAt: row.updatedAt, lastMessageAt: (row.data as any).lastMessageAt }));
  }

  @Get(':id')
  async get(@Req() req: Request & { user: any }, @Param('id') id: string) {
    const business = await this.business(req);
    const row = await this.db.businessRecord.findFirst({ where: { id, businessId: business.id, type: 'supportConversation' } });
    if (!row) throw new NotFoundException('Support conversation not found.');
    const { requestHash: _requestHash, ...data } = row.data as any;
    return { id: row.id, status: row.status, ...data, createdAt: row.createdAt, updatedAt: row.updatedAt };
  }

  @Patch(':id')
  async update(@Req() req: Request & { user: any }, @Param('id') id: string, @Body() body: SupportDataInput) {
    const business = await this.business(req);
    const row = await this.db.businessRecord.findFirst({ where: { id, businessId: business.id, type: 'supportConversation' } });
    if (!row) throw new NotFoundException('Support conversation not found.');
    let data;
    try { data = updateSupportConversation(row.data, body.data, req.user.id); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Check the conversation update.'); }
    const result = await this.db.businessRecord.updateMany({ where: { id, businessId: business.id, type: 'supportConversation', updatedAt: row.updatedAt }, data: { status: data.status, data: data as any } });
    if (!result.count) throw new ConflictException('This conversation changed. Reload and try again.');
    return { id, status: data.status, requiresHuman: data.requiresHuman, assignedToUserId: data.assignedToUserId };
  }

  @Post(':id/notes')
  async addNote(@Req() req: Request & { user: any }, @Param('id') id: string, @Body() body: SupportDataInput) {
    const business = await this.business(req);
    const row = await this.db.businessRecord.findFirst({ where: { id, businessId: business.id, type: 'supportConversation' } });
    if (!row) throw new NotFoundException('Support conversation not found.');
    const note = typeof body.data.note === 'string' ? body.data.note.trim().slice(0, 4000) : '';
    if (!note) throw new BadRequestException('Write a note first.');
    const data = appendSupportNote(row.data, note, req.user.id);
    const result = await this.db.businessRecord.updateMany({ where: { id, businessId: business.id, type: 'supportConversation', updatedAt: row.updatedAt }, data: { data: data as any } });
    if (!result.count) throw new ConflictException('This conversation changed. Reload and try again.');
    return { id, note: data.messages[data.messages.length - 1] };
  }
}
