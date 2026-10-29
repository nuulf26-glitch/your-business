import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { validateWebsite } from './website-policy';

const siteFields = new Set(['brandName', 'tagline', 'description', 'primaryColor', 'backgroundColor', 'textColor', 'bodyFont', 'headingFont', 'buttonRadius']);
const sectionTypes = new Set(['hero', 'about', 'services', 'gallery', 'collection', 'faq', 'reviews', 'contact', 'footer', 'heading', 'text', 'button', 'photo', 'divider', 'spacer']);
const sectionFields = new Set(['title', 'body', 'buttonText', 'eyebrow', 'href', 'variant', 'alt', 'limit', 'responsive']);
const styleFields = new Set(['fontFamily', 'fontSize', 'color', 'backgroundColor', 'textAlign', 'paddingY', 'letterSpacing', 'lineHeight', 'maxWidth', 'minHeight', 'hidden']);
const deleteIntent = /\b(delete|remove|take out|erase|get rid of)\b/i;

function validateStyleFields(style: Record<string, unknown>) {
  if (Object.keys(style).some(key => !styleFields.has(key))) throw new BadRequestException('AI returned unsupported style settings. Please try again.');
  for (const [key, value] of Object.entries(style)) {
    if (['color', 'backgroundColor'].includes(key) && (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))) throw new BadRequestException('AI returned an invalid colour. Please try again.');
    if (['fontSize', 'paddingY', 'maxWidth', 'minHeight', 'letterSpacing', 'lineHeight'].includes(key) && (typeof value !== 'number' || !Number.isFinite(value))) throw new BadRequestException('AI returned invalid layout settings. Please try again.');
    if (key === 'fontSize' && (Number(value) < 8 || Number(value) > 180)) throw new BadRequestException('AI returned invalid layout settings. Please try again.');
    if (key === 'paddingY' && (Number(value) < 0 || Number(value) > 400)) throw new BadRequestException('AI returned invalid layout settings. Please try again.');
    if (key === 'maxWidth' && (Number(value) < 160 || Number(value) > 2400)) throw new BadRequestException('AI returned invalid layout settings. Please try again.');
    if (key === 'minHeight' && (Number(value) < 100 || Number(value) > 2400)) throw new BadRequestException('AI returned invalid layout settings. Please try again.');
    if (key === 'letterSpacing' && (Number(value) < -0.2 || Number(value) > 1)) throw new BadRequestException('AI returned invalid layout settings. Please try again.');
    if (key === 'lineHeight' && (Number(value) < 0.8 || Number(value) > 2.5)) throw new BadRequestException('AI returned invalid layout settings. Please try again.');
    if (key === 'textAlign' && !['left', 'center', 'right', 'justify'].includes(String(value))) throw new BadRequestException('AI returned invalid layout settings. Please try again.');
    if (key === 'hidden' && typeof value !== 'boolean') throw new BadRequestException('AI returned invalid layout settings. Please try again.');
    if (key === 'fontFamily' && (typeof value !== 'string' || value.length > 80)) throw new BadRequestException('AI returned invalid layout settings. Please try again.');
  }
}

export function applyAiWebsiteOperations(input: Record<string, any>, raw: unknown, prompt: string) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('AI returned an invalid edit. Please try again.');
  const operations = (raw as any).operations;
  if (!Array.isArray(operations) || operations.length > 30) throw new BadRequestException('AI returned an incomplete edit. Please try again.');
  const model = JSON.parse(JSON.stringify(input));
  const pages: any[] = Array.isArray(model.pages) && model.pages.length
    ? model.pages
    : [{ id: 'home', slug: '', title: 'Home', sections: Array.isArray(model.sections) ? model.sections : [] }];
  const touched = new Set<string>();

  for (const operation of operations) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) throw new BadRequestException('AI returned an invalid edit. Please try again.');
    if (operation.type === 'site_style') {
      const fields = operation.fields;
      if (!fields || typeof fields !== 'object' || Array.isArray(fields) || Object.keys(fields).some(key => !siteFields.has(key))) throw new BadRequestException('AI returned an unsupported site setting. Please try again.');
      for (const [key, value] of Object.entries(fields)) {
        if (key.toLowerCase().includes('color') && (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))) throw new BadRequestException('AI returned an invalid colour. Please try again.');
        if (typeof value !== 'string' || value.length > 200) throw new BadRequestException('AI returned an invalid site setting. Please try again.');
        model[key] = value;
        touched.add(key.replace(/([A-Z])/g, ' $1').toLowerCase());
      }
      continue;
    }
    const page = pages.find(item => item.id === operation.pageId) || (pages.length === 1 ? pages[0] : null);
    if (operation.type === 'add_section') {
      if (!page || !sectionTypes.has(operation.section?.type)) throw new BadRequestException('AI tried to add an unsupported section. Please try again.');
      const section = operation.section;
      const clean:Record<string,any> = { id: `ai-${randomBytes(8).toString('hex')}`, type: section.type, label: typeof section.label === 'string' ? section.label.slice(0, 80) : section.type, title: typeof section.title === 'string' ? section.title.slice(0, 240) : '', body: typeof section.body === 'string' ? section.body.slice(0, 2000) : '', style: { fontFamily: 'Arial', fontSize: 28, color: model.textColor || '#171513' } };
      for (const key of ['buttonText', 'eyebrow', 'href', 'variant']) if (section[key] !== undefined) clean[key] = section[key];
      if (section.type === 'collection' && section.limit !== undefined) {
        if (!Number.isInteger(section.limit) || section.limit < 1 || section.limit > 24) throw new BadRequestException('AI returned an invalid product collection size. Please try again.');
        clean.limit = section.limit;
      }
      if (section.type === 'reviews') clean.items = [{ name: 'Customer name', quote: 'Add a real customer review here.' }];
      else if (section.items !== undefined) {
        if (!['faq','services'].includes(section.type) || !Array.isArray(section.items) || section.items.length > 12) throw new BadRequestException('AI returned invalid section content. Please try again.');
        clean.items = section.items;
      }
      const after = operation.afterSectionId ? page.sections.findIndex((item: any) => item.id === operation.afterSectionId) : page.sections.length - 1;
      if (after < -1) throw new BadRequestException('AI referenced a missing section. Please try again.');
      page.sections.splice(after + 1, 0, clean);
      touched.add(`added ${clean.label}`);
      continue;
    }
    if (operation.type === 'delete_section') {
      if (!deleteIntent.test(prompt)) throw new BadRequestException('AI tried to remove content you did not ask to remove. Please try again.');
      if (!page) throw new BadRequestException('AI referenced a missing page. Please try again.');
      const index = page.sections.findIndex((item: any) => item.id === operation.sectionId);
      if (index < 0 || page.sections[index].locked || page.sections.length <= 1) throw new BadRequestException('AI could not safely remove that section. Please try again.');
      page.sections.splice(index, 1);
      touched.add('removed a section');
      continue;
    }
    if (!page) throw new BadRequestException('AI could not identify the page to edit. Please try again.');
    const index = page.sections.findIndex((item: any) => item.id === operation.sectionId);
    if (operation.type === 'update_section') {
      if (index < 0 || !operation.fields || typeof operation.fields !== 'object' || Array.isArray(operation.fields)) throw new BadRequestException('AI referenced a missing section. Please try again.');
      const fields = operation.fields;
      if (Object.keys(fields).some(key => !sectionFields.has(key) && key !== 'style')) throw new BadRequestException('AI returned an unsupported section edit. Please try again.');
      if (fields.style !== undefined && (!fields.style || typeof fields.style !== 'object' || Array.isArray(fields.style) || Object.keys(fields.style).some(key => !styleFields.has(key)))) throw new BadRequestException('AI returned unsupported style settings. Please try again.');
      for (const [key, value] of Object.entries(fields)) {
        if (!['style', 'responsive', 'limit'].includes(key) && (typeof value !== 'string' || value.length > (key === 'body' ? 2000 : 500))) throw new BadRequestException('AI returned invalid section content. Please try again.');
      }
      if (fields.style !== undefined) validateStyleFields(fields.style);
      if (fields.limit !== undefined && (page.sections[index].type !== 'collection' || !Number.isInteger(fields.limit) || fields.limit < 1 || fields.limit > 24)) throw new BadRequestException('AI returned an invalid product collection size. Please try again.');
      if (fields.responsive !== undefined) {
        if (!fields.responsive || typeof fields.responsive !== 'object' || Array.isArray(fields.responsive) || Object.keys(fields.responsive).some(device => !['laptop', 'ipad', 'phone'].includes(device))) throw new BadRequestException('AI returned invalid responsive settings. Please try again.');
        for (const style of Object.values(fields.responsive)) {
          if (!style || typeof style !== 'object' || Array.isArray(style)) throw new BadRequestException('AI returned invalid responsive settings. Please try again.');
          validateStyleFields(style as Record<string, unknown>);
        }
      }
      if (fields.href !== undefined && !/^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i.test(String(fields.href))) throw new BadRequestException('AI returned an unsafe link. Please try again.');
      page.sections[index] = { ...page.sections[index], ...fields, ...(fields.style ? { style: { ...page.sections[index].style, ...fields.style } } : {}), ...(fields.responsive ? { responsive: { ...page.sections[index].responsive, ...Object.fromEntries(Object.entries(fields.responsive).map(([device, style]) => [device, { ...page.sections[index].responsive?.[device], ...(style as object) }])) } } : {}) };
      touched.add(`updated ${page.sections[index].label || page.sections[index].type}`);
      continue;
    }
    if (operation.type === 'move_section') {
      const target = page.sections.findIndex((item: any) => item.id === operation.beforeSectionId);
      if (index < 0 || target < 0 || index === target || page.sections[index].locked) throw new BadRequestException('AI could not safely reorder those sections. Please try again.');
      const [section] = page.sections.splice(index, 1);
      page.sections.splice(page.sections.findIndex((item: any) => item.id === operation.beforeSectionId), 0, section);
      touched.add('reordered sections');
      continue;
    }
    throw new BadRequestException('AI returned an unsupported edit. Please try again.');
  }

  if (!operations.length) throw new BadRequestException('AI could not find a safe change to make. Try a more specific instruction.');
  model.pages = pages;
  model.sections = pages[0]?.sections || [];
  return { model: validateWebsite(model, false), changesSummary: [...touched].join(', ') };
}
