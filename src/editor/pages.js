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
function uniqueSlug(pages, title, exceptId) {
  const base = pageSlug(title) || 'page';
  const used = new Set(pages.filter(page => page.id !== exceptId).map(page => page.slug));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
export function cloneSectionWithNewIds(section, createId = prefix => `${prefix}-${Date.now()}`) {
  return { ...JSON.parse(JSON.stringify(section)), id: createId(section.type || 'section'), ...(Array.isArray(section.children) ? { children: section.children.map(child => cloneSectionWithNewIds(child, createId)) } : {}) };
}
export function duplicateWebsitePage(model, pageId, createId = () => `page-${Date.now()}`) {
  const pages = websitePages(model);
  const source = pages.find(page => page.id === pageId);
  if (!source) throw new Error('Choose a page to duplicate.');
  const id = createId('page');
  const copy = JSON.parse(JSON.stringify(source));
  copy.id = id;
  copy.title = `${source.title} copy`;
  copy.slug = uniqueSlug(pages, copy.title);
  copy.sections = copy.sections.map(section => cloneSectionWithNewIds(section, createId));
  const index = pages.findIndex(page => page.id === pageId);
  const next = [...pages];
  next.splice(index + 1, 0, copy);
  return { ...model, pages: next, sections: next[0].sections };
}
export function setHomepage(model, pageId) {
  const pages = websitePages(model);
  const index = pages.findIndex(page => page.id === pageId);
  if (index < 0) throw new Error('Choose a page to make the homepage.');
  if (index === 0) return model;
  const next = [...pages];
  const [selectedHome] = next.splice(index, 1);
  const homepage = { ...selectedHome, sections: selectedHome.sections };
  const previousHome = { ...next[0] };
  next[0] = previousHome;
  const oldHomeSlug = uniqueSlug(pages, previousHome.title, previousHome.id);
  homepage.slug = '';
  previousHome.slug = oldHomeSlug;
  next.unshift(homepage);
  return { ...model, pages: next, sections: next[0].sections };
}
export function deleteWebsitePage(model, pageId) {
  const pages = websitePages(model);
  if (pages.length <= 1) throw new Error('A website must keep at least one page.');
  if (!pages.some(page => page.id === pageId)) return model;
  if (pages[0].id === pageId) throw new Error('Choose another page as the homepage before deleting this page.');
  const next = pages.filter(page => page.id !== pageId);
  return { ...model, pages: next, sections: next[0].sections };
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
