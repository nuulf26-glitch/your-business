const PUBLIC_FIELDS = ['editorVersion', 'brandName', 'primaryColor', 'backgroundColor', 'textColor', 'bodyFont', 'headingFont', 'buttonRadius', 'logo', 'tagline', 'description', 'pages', 'sections', 'elements', 'template', 'headline', 'buttonText', 'heroTitle', 'heroText', 'heroImageUrl'];

function publicProjection(model = {}) {
  const fields = PUBLIC_FIELDS.filter(field => model[field] !== undefined);
  // `sections` is a compatibility alias for the first page. The renderer reads
  // page sections when `pages` exists, so comparing the alias can mark an
  // unchanged published site as modified after legacy editor migration.
  if (Array.isArray(model.pages) && model.pages.length) {
    const sectionsIndex = fields.indexOf('sections');
    if (sectionsIndex !== -1) fields.splice(sectionsIndex, 1);
  }
  const projection = Object.fromEntries(fields.map(field => [field, model[field]]));
  if (!projection.brandName) projection.brandName = model.businessName || model.storeName || 'Your Business';
  return projection;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

export function websitePublicationStatus(record) {
  if (!record?.published || !record.publishedAt) return 'Draft';
  return JSON.stringify(canonicalize(publicProjection(record.draft))) === JSON.stringify(canonicalize(publicProjection(record.published))) ? 'Published' : 'Unpublished changes';
}
