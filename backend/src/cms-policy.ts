export type CmsFieldType = 'text' | 'longText' | 'number' | 'date' | 'url' | 'image' | 'boolean';
export type CmsField = { key: string; label: string; type: CmsFieldType; required?: boolean };

const FIELD_TYPES: CmsFieldType[] = ['text', 'longText', 'number', 'date', 'url', 'image', 'boolean'];
const KEY = /^[a-z][a-z0-9_]{0,39}$/;

export function normalizeCmsSlug(value: unknown, label = 'slug'): string {
  const slug = String(value ?? '').trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new Error(`Enter a valid ${label} using lowercase letters, numbers, and hyphens.`);
  }
  return slug;
}

export function normalizeCmsFields(value: unknown): CmsField[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new Error('Add between 1 and 30 collection fields.');
  const fields = value.map((raw: any) => {
    const key = String(raw?.key ?? '').trim();
    const label = String(raw?.label ?? '').trim().slice(0, 80);
    const type = String(raw?.type ?? '') as CmsFieldType;
    if (!KEY.test(key) || !label || !FIELD_TYPES.includes(type)) throw new Error('Each field needs a valid key, label, and supported type.');
    return { key, label, type, required: Boolean(raw.required) };
  });
  if (new Set(fields.map((field) => field.key)).size !== fields.length) throw new Error('Field keys must be unique.');
  return fields;
}

export function normalizeCmsCategories(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  if (!Array.isArray(value) || value.length > 50) throw new Error('Add up to 50 categories.');
  const categories = value.map((item) => String(item ?? '').trim().slice(0, 60)).filter(Boolean);
  if (new Set(categories.map((item) => item.toLowerCase())).size !== categories.length) throw new Error('Category names must be unique.');
  return categories;
}

export function normalizeCmsContent(fields: CmsField[], input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Enter content for this entry.');
  const supplied = input as Record<string, unknown>;
  const allowed = new Set(fields.map((field) => field.key));
  if (Object.keys(supplied).some((key) => !allowed.has(key))) throw new Error('Content contains a field that is not in this collection.');
  const content: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = supplied[field.key];
    if (raw === undefined || raw === null || raw === '') {
      if (field.required) throw new Error(`${field.label} is required.`);
      content[field.key] = field.type === 'boolean' ? false : '';
      continue;
    }
    if (field.type === 'boolean') {
      if (typeof raw !== 'boolean') throw new Error(`${field.label} must be yes or no.`);
      content[field.key] = raw;
    } else if (field.type === 'number') {
      const number = Number(raw);
      if (!Number.isFinite(number)) throw new Error(`${field.label} must be a number.`);
      content[field.key] = number;
    } else {
      const text = String(raw).trim();
      const max = field.type === 'longText' ? 12000 : field.type === 'image' ? 2048 : 500;
      if (text.length > max) throw new Error(`${field.label} is too long.`);
      if (field.type === 'url' || field.type === 'image') {
        let parsed: URL;
        try { parsed = new URL(text); } catch { throw new Error(`${field.label} must be a valid HTTPS URL.`); }
        if (parsed.protocol !== 'https:') throw new Error(`${field.label} must use HTTPS.`);
      }
      if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${field.label} must be a date.`);
      content[field.key] = text;
    }
  }
  return content;
}
