import { websitePages } from './pages.js';
// Legacy stores remain readable until explicitly unpublished.
export function publishedWebsite(store) {
  if (!store || store.published === false) return null;
  return store.publishedEditorData || store.editorData || (store.draftEditorData ? null : store);
}
export function draftWebsite(store) {
  return store?.draftEditorData || store?.editorData || store;
}
export function validateWebsite(model) {
  if (!model?.brandName?.trim()) throw new Error('Add your business name before publishing.');
  const pages = websitePages(model);
  if (!pages.length || pages.length > 100) throw new Error('A website needs between 1 and 100 pages.');
  const pageIds = new Set(), slugs = new Set();
  for (const [index,page] of pages.entries()) {
    if (!page.id || pageIds.has(page.id) || typeof page.slug !== 'string' || slugs.has(page.slug) || (index === 0 && page.slug !== '') || (index > 0 && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug))) throw new Error('Page IDs and addresses must be valid and unique.');
    pageIds.add(page.id); slugs.add(page.slug);
    if (!Array.isArray(page.sections) || !page.sections.length) throw new Error(`Add at least one section to ${page.title}.`);
    const ids = page.sections.map(section => section.id);
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error('Section IDs must be unique.');
  }
  const snapshot = JSON.parse(JSON.stringify(model));
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > 350000) throw new Error('Your website is too large. Reduce embedded content before publishing.');
  return snapshot;
}
export function draftPatch(store, model) {
  const live = publishedWebsite(store);
  return { ...(live && !store?.publishedEditorData ? { publishedEditorData: live } : {}), draftEditorData: JSON.parse(JSON.stringify(model)) };
}
export function publishPatch(model, timestamp = new Date().toISOString()) {
  const snapshot = validateWebsite(model);
  return { draftEditorData: snapshot, publishedEditorData: snapshot, editorData: snapshot, published: true, publishedAt: timestamp };
}
