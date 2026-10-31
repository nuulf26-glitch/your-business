import { WebsiteController } from '../src/routes';

describe('website draft and publish persistence', () => {
  function createFixture(withWebsite = true) {
    const published = { brandName: 'LUNE', sections: [{ id: 'live-hero', type: 'hero', title: 'Live version' }] };
    const website: any = withWebsite ? { id: 'website', businessId: 'business', draft: published, published, revision: 1, publishedAt: new Date('2026-01-01T00:00:00Z') } : {};
    const business = { id: 'business', ownerId: 'owner', slug: 'lune', name: 'LUNE', category: 'retail', website };
    const websiteVersion = { create: jest.fn().mockResolvedValue({ id: 'version-1' }) };
    const tx = {
      website: { upsert: jest.fn(async ({ create, update }: any) => {
        if (!withWebsite && create) Object.assign(website, { id: 'website', businessId: 'business', revision: 1, ...create });
        if (withWebsite && update) {
          website.draft = update.draft;
          website.published = update.published;
          website.publishedAt = update.publishedAt;
          if (update.revision?.increment) website.revision += update.revision.increment;
        }
        return website;
      }) },
      websiteVersion,
    };
    const db: any = {
      business: {
        findFirst: jest.fn(async ({ where }: any) => where.ownerId === 'owner' ? business : null),
        findUnique: jest.fn(async ({ where }: any) => where.slug === business.slug ? business : null),
      },
      website: {
        upsert: jest.fn(async ({ create, update }: any) => {
          if (create) website.draft = create.draft;
          if (update) { website.draft = update.draft; website.revision += update.revision.increment; }
          return website;
        }),
        findUnique: jest.fn(async () => website),
      },
      $transaction: jest.fn(async (callback: (value: any) => Promise<unknown>) => callback(tx)),
    };
    return { controller: new WebsiteController(db), db, website, websiteVersion, business };
  }

  it('keeps draft edits private until publish, then stores a public snapshot and version', async () => {
    const { controller, db, website, websiteVersion, business } = createFixture();
    const draft = { editorVersion: 2, brandName: 'LUNE', sections: [{ id: 'hero', type: 'hero', title: 'Unpublished draft' }] };
    await controller.saveDraft({ user: { id: 'owner' } } as any, { model: draft } as any);

    expect(db.business.findFirst).toHaveBeenCalledWith({ where: { ownerId: 'owner' } });
    expect(website.draft.sections[0].title).toBe('Unpublished draft');
    expect(website.published.sections[0].title).toBe('Live version');
    expect(await controller.publicSite({ params: { slug: 'lune' } } as any)).toMatchObject({ published: true, website: { brandName: 'LUNE', sections: [{ title: 'Live version' }] } });

    const nextDraft = { editorVersion: 2, brandName: 'LUNE', sections: [{ id: 'hero', type: 'hero', title: 'Published design' }] };
    await controller.publish({ user: { id: 'owner' } } as any, { model: nextDraft } as any);

    expect(website.published.sections[0].title).toBe('Published design');
    expect(website.revision).toBe(3);
    expect(websiteVersion.create).toHaveBeenCalledWith({ data: { websiteId: 'website', snapshot: website.draft } });
    expect(website.draft).not.toHaveProperty('editorMode');
    expect(business.slug).toBe('lune');

    const liveSnapshot = website.published;
    const liveTimestamp = website.publishedAt;
    await controller.saveDraft({ user: { id: 'owner' } } as any, { model: { ...nextDraft, sections: [{ id: 'hero', type: 'hero', title: 'Next unpublished edit' }] } } as any);
    expect(website.draft.sections[0].title).toBe('Next unpublished edit');
    expect(website.published).toBe(liveSnapshot);
    expect(website.publishedAt).toBe(liveTimestamp);
    const publicAfterDraftSave: any = await controller.publicSite({ params: { slug: 'lune' } } as any);
    expect(publicAfterDraftSave.website.sections[0].title).toBe('Published design');
  });

  it('publishes the current design atomically even when no prior draft row exists', async () => {
    const { controller, website, websiteVersion, db } = createFixture(false);
    const model = { editorVersion: 2, brandName: 'NEW', sections: [{ id: 'hero', type: 'hero', title: 'First publish' }] };
    await controller.publish({ user: { id: 'owner' } } as any, { model } as any);
    expect(website.published.sections[0].title).toBe('First publish');
    expect(website.draft.sections[0].title).toBe('First publish');
    expect(website.publishedAt).toBeInstanceOf(Date);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(websiteVersion.create).toHaveBeenCalledWith({ data: { websiteId: 'website', snapshot: website.draft } });
  });

  it('does not let a different account save or publish this business website', async () => {
    const { controller, db } = createFixture();
    await expect(controller.saveDraft({ user: { id: 'another-owner' } } as any, { model: { brandName: 'Injected', sections: [] } } as any)).rejects.toThrow('Create a business first');
    await expect(controller.publish({ user: { id: 'another-owner' } } as any, { model: { brandName: 'Injected', sections: [{ id: 'hero', type: 'hero' }] } } as any)).rejects.toThrow('Create a business before publishing');
    expect(db.website.upsert).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
