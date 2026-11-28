const FORM_FIELD_ID = /^[A-Za-z0-9_-]{1,80}$/;
const SUPPORTED_TYPES = new Set(['text', 'textarea', 'select', 'checkbox']);

export function findPublishedContactForm(model: any, formId: string): any | null {
  const sections: any[] = [];
  const visit = (items: any[]) => {
    for (const item of items || []) {
      if (item?.type === 'contact') sections.push(item);
      if (Array.isArray(item?.children)) visit(item.children);
    }
  };
  if (Array.isArray(model?.pages)) for (const page of model.pages) visit(page?.sections);
  else if (Array.isArray(model?.sections)) visit(model.sections);
  return sections.find(section => String(section.id) === formId) || null;
}

export function assertPublishedContactFormDefinition(section: any): any[] {
  const fields = Array.isArray(section?.formFields) ? section.formFields : [];
  if (fields.length > 12) throw new Error('This form has too many custom questions');
  const ids = new Set<string>();
  for (const [index, field] of fields.entries()) {
    if (!field || typeof field.id !== 'string' || !FORM_FIELD_ID.test(field.id) || ['__proto__', 'prototype', 'constructor'].includes(field.id) || ids.has(field.id)) throw new Error('This form has invalid field configuration');
    if (!SUPPORTED_TYPES.has(field.type) || !String(field.label || '').trim() || String(field.label).length > 100) throw new Error('This form has invalid field configuration');
    if (field.required !== undefined && typeof field.required !== 'boolean') throw new Error('This form has invalid field configuration');
    if (field.type === 'select' && (!Array.isArray(field.options) || field.options.length < 2 || field.options.length > 20 || field.options.some((value: unknown) => typeof value !== 'string' || !value.trim() || value.length > 100) || new Set(field.options).size !== field.options.length)) throw new Error('This form has invalid field configuration');
    if (field.type !== 'select' && field.options !== undefined) throw new Error('This form has invalid field configuration');
    if (field.showWhen !== undefined) {
      const parentIndex = fields.findIndex((candidate: any) => candidate.id === field.showWhen?.fieldId);
      const parent = fields[parentIndex];
      if (parentIndex < 0 || parentIndex >= index || !['select', 'checkbox'].includes(parent.type)) throw new Error('This form has invalid conditional rules');
      if (parent.type === 'select' && !parent.options.includes(String(field.showWhen.value))) throw new Error('This form has invalid conditional rules');
      if (parent.type === 'checkbox' && field.showWhen.value !== 'true') throw new Error('This form has invalid conditional rules');
      if (typeof field.showWhen.value !== 'string' || field.showWhen.value.length > 100) throw new Error('This form has invalid conditional rules');
    }
    ids.add(field.id);
  }
  return fields;
}

export function validatePublishedFormAnswers(section: any, input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid form answers');
  const fields = assertPublishedContactFormDefinition(section);
  const ids = new Set<string>(fields.map(field => field.id));

  const answers = input as Record<string, unknown>;
  const visible = new Map<string, boolean>();
  const accepted: Record<string, string> = Object.create(null);
  for (const field of fields) {
    const condition = field.showWhen;
    if (condition) {
      const parent = fields.find((candidate: any) => candidate.id === condition.fieldId);
      if (!parent || !['select', 'checkbox'].includes(parent.type) || parent.id === field.id) throw new Error('This form has invalid conditional rules');
      if (parent.type === 'select' && !parent.options.includes(String(condition.value))) throw new Error('This form has invalid conditional rules');
      if (parent.type === 'checkbox' && condition.value !== 'true') throw new Error('This form has invalid conditional rules');
      visible.set(field.id, !!visible.get(parent.id) && String(answers[parent.id] ?? '') === String(condition.value));
    } else visible.set(field.id, true);

    const raw = answers[field.id];
    if (!visible.get(field.id)) {
      if (raw !== undefined) throw new Error('A hidden form question was submitted');
      continue;
    }
    if (raw === undefined || raw === null || raw === '') {
      if (field.required) throw new Error(`Complete: ${String(field.label).trim()}`);
      continue;
    }
    if (typeof raw !== 'string' || raw.length > 2000) throw new Error('Invalid form answer');
    const value = raw.trim();
    if (field.required && !value) throw new Error(`Complete: ${String(field.label).trim()}`);
    if (field.type === 'select' && !field.options.includes(value)) throw new Error('Invalid form choice');
    if (field.type === 'checkbox' && value !== 'true') throw new Error('Invalid checkbox answer');
    if (value) accepted[field.id] = value;
  }
  if (Object.keys(answers).some(key => !ids.has(key))) throw new Error('Unknown form question');
  return accepted;
}
