import { NotFoundException } from '@nestjs/common';
import { CmsController, PublicCmsController } from '../src/cms';

describe('CMS tenant access and publication rules', () => {
  it('scopes owner collection reads by the authenticated user and selected business', async () => {
    const db: any = {
      business: { findFirst: jest.fn().mockResolvedValue({ id: 'business-owned' }) },
      businessRecord: { findMany: jest.fn().mockResolvedValue([{ id: 'collection-1', data: { name: 'Stories', slug: 'stories', fields: [] }, updatedAt: new Date('2026-11-22T00:00:00Z') }]) },
    };
    const controller = new CmsController(db);
    const result = await controller.listCollections({ user: { id: 'owner-1' }, get: () => 'business-owned' } as any);
    expect(db.business.findFirst).toHaveBeenCalledWith({ where: { ownerId: 'owner-1', id: 'business-owned' } });
    expect(db.businessRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'business-owned', type: 'cmsCollection', status: { not: 'archived' } } }));
    expect(result[0]).toMatchObject({ id: 'collection-1', name: 'Stories' });
  });

  it('does not let an owner address another business collection', async () => {
    const db: any = {
      business: { findFirst: jest.fn().mockResolvedValue({ id: 'owner-business' }) },
      businessRecord: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const controller = new CmsController(db);
    await expect(controller.archiveCollection({ user: { id: 'owner-1' }, get: () => 'owner-business' } as any, 'foreign-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(db.businessRecord.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'owner-business', id: 'foreign-id', type: 'cmsCollection', status: { not: 'archived' } } }));
  });

  it('keeps public CMS unpublished until the website and entry are published', async () => {
    const db: any = {
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'business-1', website: { published: false } }) },
      businessRecord: { findMany: jest.fn() },
    };
    const controller = new PublicCmsController(db);
    await expect(controller.publishedEntries('store', 'stories')).rejects.toBeInstanceOf(NotFoundException);
    expect(db.businessRecord.findMany).not.toHaveBeenCalled();
    db.business.findUnique.mockResolvedValue({ id: 'business-1', website: { published: true } });
    db.businessRecord.findMany
      .mockResolvedValueOnce([{ id: 'collection-1', status: 'active', data: { name: 'Stories', slug: 'stories', fields: [{ key: 'title', label: 'Title', type: 'text' }] } }])
      .mockResolvedValueOnce([{ id: 'entry-1', status: 'published', data: { collectionId: 'collection-1', slug: 'hello', title: 'Hello', content: { title: 'Hello' }, publishedAt: '2026-11-22T00:00:00.000Z' } }]);
    const result = await controller.publishedEntries('store', 'stories');
    expect(db.businessRecord.findMany.mock.calls[1][0].where).toEqual(expect.objectContaining({ businessId: 'business-1', type: 'cmsEntry', status: 'published' }));
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).not.toHaveProperty('email');
  });
});
