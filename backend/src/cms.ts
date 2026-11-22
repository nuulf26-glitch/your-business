import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsObject } from 'class-validator';
import { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { DbService } from './database';
import { SessionGuard } from './session';
import { normalizeCmsCategories, normalizeCmsContent, normalizeCmsFields, normalizeCmsSlug } from './cms-policy';

class CmsDataInput { @IsObject() data!: Record<string, unknown>; }
type UserRequest = Request & { user: { id: string } };
const bounded = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
const rowValue = (value: any) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

@Controller('cms')
@UseGuards(SessionGuard)
export class CmsController {
  constructor(private readonly db: DbService) {}

  private async business(req: UserRequest) {
    const selected = bounded(req.get('x-cyb-business-id'), 120);
    const business = await this.db.business.findFirst({ where: { ownerId: req.user.id, ...(selected ? { id: selected } : {}) } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  private async collection(businessId: string, id: string) {
    const row = await this.db.businessRecord.findFirst({ where: { businessId, id, type: 'cmsCollection', status: { not: 'archived' } } });
    if (!row) throw new NotFoundException('Collection not found');
    return row;
  }

  @Get('collections')
  async listCollections(@Req() req: UserRequest) {
    const business = await this.business(req);
    const rows = await this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'cmsCollection', status: { not: 'archived' } }, orderBy: { updatedAt: 'desc' }, take: 200 });
    return rows.map((row) => ({ id: row.id, ...rowValue(row.data), updatedAt: row.updatedAt }));
  }

  @Post('collections')
  async createCollection(@Req() req: UserRequest, @Body() dto: CmsDataInput) {
    const business = await this.business(req), data = rowValue(dto.data);
    const name = bounded(data.name, 80);
    if (!name) throw new BadRequestException('Collection name is required.');
    const slug = this.safe(() => normalizeCmsSlug(data.slug || name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''), 'collection slug'));
    const fields = this.safe(() => normalizeCmsFields(data.fields));
    const categories = this.safe(() => normalizeCmsCategories(data.categories));
    const existing = await this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'cmsCollection', status: { not: 'archived' } }, take: 500 });
    if (existing.some((row) => (row.data as any)?.slug === slug)) throw new BadRequestException('A collection with that URL already exists.');
    const row = await this.db.businessRecord.create({ data: { businessId: business.id, type: 'cmsCollection', status: 'active', data: { name, slug, description: bounded(data.description, 500), fields, categories, createdAt: new Date().toISOString() } as any } });
    return { id: row.id, ...rowValue(row.data) };
  }

  @Patch('collections/:id')
  async updateCollection(@Req() req: UserRequest, @Param('id') id: string, @Body() dto: CmsDataInput) {
    const business = await this.business(req), prior = await this.collection(business.id, id), old = rowValue(prior.data), patch = rowValue(dto.data);
    const name = patch.name === undefined ? old.name : bounded(patch.name, 80);
    if (!name) throw new BadRequestException('Collection name is required.');
    const slug = patch.slug === undefined ? old.slug : this.safe(() => normalizeCmsSlug(patch.slug, 'collection slug'));
    const fields = patch.fields === undefined ? old.fields : this.safe(() => normalizeCmsFields(patch.fields));
    const categories = patch.categories === undefined ? normalizeCmsCategories(old.categories) : this.safe(() => normalizeCmsCategories(patch.categories));
    const rows = await this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'cmsCollection', status: { not: 'archived' } }, take: 500 });
    if (rows.some((row) => row.id !== id && (row.data as any)?.slug === slug)) throw new BadRequestException('A collection with that URL already exists.');
    const data = { ...old, name, slug, description: patch.description === undefined ? old.description : bounded(patch.description, 500), fields, categories };
    const updated = await this.db.businessRecord.updateMany({ where: { id, businessId: business.id, type: 'cmsCollection', status: { not: 'archived' } }, data: { data: data as any } });
    if (!updated.count) throw new NotFoundException('Collection not found');
    return { id, ...data };
  }

  @Delete('collections/:id')
  async archiveCollection(@Req() req: UserRequest, @Param('id') id: string) {
    const business = await this.business(req), row = await this.collection(business.id, id);
    const result = await this.db.businessRecord.updateMany({ where: { id, businessId: business.id, type: 'cmsCollection' }, data: { status: 'archived', data: { ...rowValue(row.data), archivedAt: new Date().toISOString() } as any } });
    if (!result.count) throw new NotFoundException('Collection not found');
    return { archived: true, id };
  }

  @Get('collections/:collectionId/entries')
  async listEntries(@Req() req: UserRequest, @Param('collectionId') collectionId: string, @Query('status') status = '') {
    const business = await this.business(req);
    await this.collection(business.id, collectionId);
    const rows = await this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'cmsEntry', status: status && ['draft', 'published', 'archived'].includes(status) ? status : { not: 'archived' } as any, data: { path: ['collectionId'], equals: collectionId } }, orderBy: { updatedAt: 'desc' }, take: 500 });
    return rows.map((row) => ({ id: row.id, ...rowValue(row.data), status: row.status, updatedAt: row.updatedAt }));
  }

  @Post('collections/:collectionId/entries')
  async createEntry(@Req() req: UserRequest, @Param('collectionId') collectionId: string, @Body() dto: CmsDataInput) {
    const business = await this.business(req), collection = await this.collection(business.id, collectionId), data = rowValue(dto.data);
    const normalized = this.entryData(collectionId, rowValue(collection.data).fields, rowValue(collection.data).categories, data);
    await this.assertUniqueEntrySlug(business.id, collectionId, normalized.slug);
    const id = `cms_${randomUUID().replace(/-/g, '')}`;
    const row = await this.db.businessRecord.create({ data: { id, businessId: business.id, type: 'cmsEntry', status: 'draft', data: { ...normalized, collectionId, publishedAt: null, createdAt: new Date().toISOString() } as any } });
    return { id: row.id, ...rowValue(row.data), status: row.status };
  }

  @Patch('entries/:id')
  async updateEntry(@Req() req: UserRequest, @Param('id') id: string, @Body() dto: CmsDataInput) {
    const business = await this.business(req), prior = await this.db.businessRecord.findFirst({ where: { businessId: business.id, id, type: 'cmsEntry', status: { not: 'archived' } } });
    if (!prior) throw new NotFoundException('Entry not found');
    const previous = rowValue(prior.data), collection = await this.collection(business.id, String(previous.collectionId || '')), patch = rowValue(dto.data);
    const merged = { ...previous, ...patch, content: patch.content === undefined ? previous.content : patch.content };
    const normalized = this.entryData(String(previous.collectionId), rowValue(collection.data).fields, rowValue(collection.data).categories, merged);
    await this.assertUniqueEntrySlug(business.id, String(previous.collectionId), normalized.slug, id);
    const data = { ...previous, ...normalized, publishedAt: prior.status === 'published' ? previous.publishedAt : null };
    const result = await this.db.businessRecord.updateMany({ where: { businessId: business.id, id, type: 'cmsEntry', status: { not: 'archived' } }, data: { status: 'draft', data: data as any } });
    if (!result.count) throw new NotFoundException('Entry not found');
    return { id, ...data, status: 'draft' };
  }

  @Post('entries/:id/publish')
  async publishEntry(@Req() req: UserRequest, @Param('id') id: string) {
    const business = await this.business(req), prior = await this.db.businessRecord.findFirst({ where: { businessId: business.id, id, type: 'cmsEntry', status: { not: 'archived' } } });
    if (!prior) throw new NotFoundException('Entry not found');
    const previous = rowValue(prior.data), collection = await this.collection(business.id, String(previous.collectionId || ''));
    const normalized = this.entryData(String(previous.collectionId), rowValue(collection.data).fields, rowValue(collection.data).categories, previous);
    const publishedAt = prior.status === 'published' ? previous.publishedAt || new Date().toISOString() : new Date().toISOString();
    const data = { ...previous, ...normalized, publishedAt };
    const result = await this.db.businessRecord.updateMany({ where: { businessId: business.id, id, type: 'cmsEntry', status: { not: 'archived' } }, data: { status: 'published', data: data as any } });
    if (!result.count) throw new NotFoundException('Entry not found');
    return { id, ...data, status: 'published' };
  }

  @Post('entries/:id/unpublish')
  async unpublishEntry(@Req() req: UserRequest, @Param('id') id: string) {
    const business = await this.business(req), row = await this.db.businessRecord.findFirst({ where: { businessId: business.id, id, type: 'cmsEntry' } });
    if (!row) throw new NotFoundException('Entry not found');
    const result = await this.db.businessRecord.updateMany({ where: { businessId: business.id, id, type: 'cmsEntry', status: 'published' }, data: { status: 'draft', data: { ...rowValue(row.data), publishedAt: null } as any } });
    if (!result.count) throw new BadRequestException('Entry is not published.');
    return { id, status: 'draft' };
  }

  @Delete('entries/:id')
  async archiveEntry(@Req() req: UserRequest, @Param('id') id: string) {
    const business = await this.business(req), row = await this.db.businessRecord.findFirst({ where: { businessId: business.id, id, type: 'cmsEntry' } });
    if (!row) throw new NotFoundException('Entry not found');
    const result = await this.db.businessRecord.updateMany({ where: { businessId: business.id, id, type: 'cmsEntry', status: { not: 'archived' } }, data: { status: 'archived', data: { ...rowValue(row.data), archivedAt: new Date().toISOString() } as any } });
    if (!result.count) throw new NotFoundException('Entry not found');
    return { archived: true, id };
  }

  private safe<T>(fn: () => T): T { try { return fn(); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Invalid CMS data.'); } }
  private entryData(collectionId: string, fields: unknown, categories: unknown, data: Record<string, any>) {
    const slug = this.safe(() => normalizeCmsSlug(data.slug, 'entry slug'));
    const content = this.safe(() => normalizeCmsContent(normalizeCmsFields(fields), data.content));
    return { collectionId, slug, title: bounded(data.title, 160) || bounded(content.title, 160) || slug, category: this.normalizeEntryCategory(data.category, categories), content };
  }
  private normalizeEntryCategory(value: unknown, categoriesValue: unknown) {
    const category = bounded(value, 60);
    const categories = normalizeCmsCategories(categoriesValue);
    if (category && !categories.some((allowed) => allowed.toLowerCase() === category.toLowerCase())) throw new BadRequestException('Choose a category from this collection.');
    return category;
  }
  private async assertUniqueEntrySlug(businessId: string, collectionId: string, slug: string, exceptId = '') {
    const rows = await this.db.businessRecord.findMany({ where: { businessId, type: 'cmsEntry', status: { not: 'archived' }, data: { path: ['collectionId'], equals: collectionId } }, take: 2000 });
    if (rows.some((row) => row.id !== exceptId && (row.data as any)?.slug === slug)) throw new BadRequestException('An entry with that URL already exists in this collection.');
  }
}

@Controller('public/cms')
export class PublicCmsController {
  constructor(private readonly db: DbService) {}

  @Get(':businessSlug/:collectionSlug')
  async publishedEntries(@Param('businessSlug') businessSlug: string, @Param('collectionSlug') collectionSlug: string, @Query('entry') entrySlug = '') {
    const business = await this.db.business.findUnique({ where: { slug: businessSlug }, include: { website: true } });
    if (!business?.website?.published) throw new NotFoundException('Published website not found.');
    const collections = await this.db.businessRecord.findMany({ where: { businessId: business.id, type: 'cmsCollection', status: 'active' }, take: 500 });
    const collection = collections.find((row) => (row.data as any)?.slug === collectionSlug);
    if (!collection) throw new NotFoundException('Published collection not found.');
    const where: any = { businessId: business.id, type: 'cmsEntry', status: 'published', data: { path: ['collectionId'], equals: collection.id } };
    const rows = await this.db.businessRecord.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });
    const filtered = rows.filter((row) => !entrySlug || (row.data as any)?.slug === entrySlug);
    return { collection: { name: (collection.data as any)?.name, slug: collectionSlug, fields: (collection.data as any)?.fields || [], categories: (collection.data as any)?.categories || [] }, entries: filtered.map((row) => ({ id: row.id, slug: (row.data as any)?.slug, title: (row.data as any)?.title, category: (row.data as any)?.category || '', content: (row.data as any)?.content || {}, publishedAt: (row.data as any)?.publishedAt })) };
  }
}
