import { normalizeCmsCategories, normalizeCmsContent, normalizeCmsFields, normalizeCmsSlug } from '../src/cms-policy';

describe('CMS data policy', () => {
  const fields = normalizeCmsFields([
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'price', label: 'Price', type: 'number' },
    { key: 'cover', label: 'Cover', type: 'image' },
    { key: 'available', label: 'Available', type: 'boolean' },
  ]);

  it('normalizes slugs and rejects malformed or oversized slugs', () => {
    expect(normalizeCmsSlug('spring-story')).toBe('spring-story');
    expect(() => normalizeCmsSlug('../private', 'entry slug')).toThrow('valid entry slug');
  });

  it('requires unique, supported collection fields', () => {
    expect(() => normalizeCmsFields([{ key: 'same', label: 'A', type: 'text' }, { key: 'same', label: 'B', type: 'text' }])).toThrow('unique');
    expect(() => normalizeCmsFields([{ key: 'raw-html', label: 'Unsafe', type: 'html' }])).toThrow('supported type');
    expect(() => normalizeCmsFields([])).toThrow('between 1 and 30');
  });

  it('normalizes collection categories and rejects duplicate names', () => {
    expect(normalizeCmsCategories(['News', 'Stories'])).toEqual(['News', 'Stories']);
    expect(() => normalizeCmsCategories(['News', 'news'])).toThrow('unique');
  });

  it('validates typed content and drops nothing silently', () => {
    expect(normalizeCmsContent(fields, { title: 'Lookbook', price: '12.5', cover: 'https://cdn.example.test/look.jpg', available: true })).toEqual({ title: 'Lookbook', price: 12.5, cover: 'https://cdn.example.test/look.jpg', available: true });
    expect(() => normalizeCmsContent(fields, { title: '', other: 'injected' })).toThrow('not in this collection');
    expect(() => normalizeCmsContent(fields, { title: '' })).toThrow('Title is required');
    expect(() => normalizeCmsContent(fields, { title: 'Lookbook', cover: 'http://example.test/look.jpg' })).toThrow('HTTPS');
    expect(() => normalizeCmsContent(fields, { title: 'Lookbook', price: '12x' })).toThrow('number');
  });
});
