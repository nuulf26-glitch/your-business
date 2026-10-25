import { websitePages, changePageSections } from './pages.js';
export const EDITOR_MODES = [
  { id: 'simple', name: 'Simple Editor', description: 'Click to edit content. Move sections without extra design controls.' },
  { id: 'advanced', name: 'Easy + Advanced', description: 'Content first, with design settings when you need them.' },
  { id: 'professional', name: 'Professional Editor', description: 'Layers, reusable sections and detailed responsive settings.' },
];
export function editorMode(value) { return EDITOR_MODES.some(mode => mode.id === value) ? value : 'advanced'; }
// Resolve the original upload target against the newest draft, not a stale closure.
export function patchPageSection(model, pageId, sectionId, update) {
  const page = websitePages(model).find(item => item.id === pageId);
  const section = page?.sections.find(item => item.id === sectionId);
  if (!section || section.locked) throw new Error('That section was removed or locked. Your other changes are safe.');
  return changePageSections(model, pageId, page.sections.map(item => item.id === sectionId ? update(item) : item));
}
export function publishWarnings(model) {
  const warnings = [];
  function visit(sections, page) {
    for (const section of sections) {
      if (['hero', 'about', 'button'].includes(section.type) && section.buttonText && !section.href?.trim()) warnings.push(`${page}: “${section.buttonText}” needs a destination before its button can appear.`);
      if (section.type === 'photo' && !section.image) warnings.push(`${page}: an image section has no photo.`);
      if (section.children) visit(section.children, page);
    }
  }
  for (const page of websitePages(model)) visit(page.sections, page.title);
  return warnings;
}
