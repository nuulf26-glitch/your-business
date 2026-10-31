const PUBLIC_FIELDS = ['editorVersion', 'brandName', 'primaryColor', 'backgroundColor', 'textColor', 'bodyFont', 'headingFont', 'buttonRadius', 'logo', 'tagline', 'description', 'pages', 'sections', 'elements', 'template', 'headline', 'buttonText', 'heroTitle', 'heroText', 'heroImageUrl'];

function publicProjection(model = {}) {
  const projection = Object.fromEntries(PUBLIC_FIELDS.filter(field => model[field] !== undefined).map(field => [field, model[field]]));
  if (!projection.brandName) projection.brandName = model.businessName || model.storeName || 'Your Business';
  return projection;
}

export function websitePublicationStatus(record) {
  if (!record?.published || !record.publishedAt) return 'Draft';
  return JSON.stringify(publicProjection(record.draft)) === JSON.stringify(publicProjection(record.published)) ? 'Published' : 'Unpublished changes';
}
