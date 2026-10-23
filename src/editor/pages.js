export function pageSlug(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function websitePages(model) {
  return model.pages?.length ? model.pages : [{ id: 'home', title: 'Home', slug: '', sections: model.sections || [] }];
}
export function changePageSections(model, pageId, sections) {
  const pages = websitePages(model).map(page => page.id === pageId ? { ...page, sections } : page);
  return { ...model, pages, sections: pages[0].sections };
}
export function addWebsitePage(model, title, id) {
  const slug = pageSlug(title);
  if (!slug || websitePages(model).some(page => page.slug === slug)) throw new Error('Choose a unique page name.');
  return { ...model, pages: [...websitePages(model), { id, title: title.trim(), slug, sections: [] }] };
}
export function safeHref(value) {
  const href = String(value || '').trim();
  if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(href) && !href.startsWith('//')) return href;
  return '';
}
export function reorderPage(model, pageId, direction) {
  const pages = [...websitePages(model)];
  const index = pages.findIndex(page => page.id === pageId);
  const target = index + direction;
  // Home remains the root URL.
  if (index <= 0 || target <= 0 || target >= pages.length) return model;
  [pages[index],pages[target]] = [pages[target],pages[index]];
  return { ...model,pages };
}
