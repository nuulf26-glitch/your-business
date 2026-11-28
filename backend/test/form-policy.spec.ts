import { findPublishedContactForm, validatePublishedFormAnswers } from '../src/form-policy';
import { validateWebsite } from '../src/website-policy';
import { PublicBusinessController } from '../src/routes';

describe('conditional contact forms', () => {
  const fields = [
    { id: 'reason', label: 'What do you need?', type: 'select', options: ['Consultation', 'Other'], required: true },
    { id: 'details', label: 'Tell us more', type: 'textarea', required: true, showWhen: { fieldId: 'reason', value: 'Other' } },
  ];
  const section = { id: 'contact-1', type: 'contact', formFields: fields };

  it('allows only safe, valid conditional question definitions to be published', () => {
    expect(validateWebsite({ brandName: 'Atelier', pages: [{ id: 'home', slug: '', title: 'Home', sections: [section] }] }).pages[0].sections[0].formFields).toEqual(fields);
    expect(() => validateWebsite({ brandName: 'Atelier', pages: [{ id: 'home', slug: '', title: 'Home', sections: [{ ...section, formFields: [{ id: 'x', label: 'Only choice', type: 'select', required: true, options: ['One'] }] }] }] })).toThrow('invalid field configuration');
    expect(() => validateWebsite({ brandName: 'Atelier', pages: [{ id: 'home', slug: '', title: 'Home', sections: [{ ...section, formFields: [{ id: 'details', label: 'Unconditional?', type: 'text', showWhen: { fieldId: 'later', value: 'yes' } }] }] }] })).toThrow('invalid conditional rules');
  });

  it('finds only forms in the published website snapshot', () => {
    const form = findPublishedContactForm({
      draft: { sections: [{ ...section, id: 'draft-only' }] },
      pages: [{ sections: [{ type: 'columns', children: [section] }] }],
    }, 'contact-1');
    expect(form).toEqual(section);
    expect(findPublishedContactForm({ sections: [{ ...section, id: 'draft-only' }] }, 'missing')).toBeNull();
  });

  it('accepts answers for visible questions and keeps values bounded', () => {
    expect(validatePublishedFormAnswers(section, { reason: 'Other', details: 'A custom request' })).toEqual({ reason: 'Other', details: 'A custom request' });
    expect(validatePublishedFormAnswers(section, { reason: 'Consultation' })).toEqual({ reason: 'Consultation' });
  });

  it('rejects an answer submitted for a hidden conditional question', () => {
    expect(() => validatePublishedFormAnswers(section, { reason: 'Consultation', details: 'Should be hidden' })).toThrow('hidden form question');
  });

  it('keeps downstream questions hidden when their conditional parent is hidden', () => {
    const nested = { id: 'contact-nested', type: 'contact', formFields: [
      { id: 'reason', label: 'Reason', type: 'select', options: ['Consultation', 'Other'], required: true },
      { id: 'followup', label: 'Follow up', type: 'select', options: ['Yes', 'No'], required: true, showWhen: { fieldId: 'reason', value: 'Other' } },
      { id: 'details', label: 'Details', type: 'text', required: true, showWhen: { fieldId: 'followup', value: 'Yes' } },
    ] };
    expect(validatePublishedFormAnswers(nested, { reason: 'Consultation' })).toEqual({ reason: 'Consultation' });
  });

  it('rejects unknown fields, invalid choices, and missing required visible answers', () => {
    expect(() => validatePublishedFormAnswers(section, { reason: 'Something else' })).toThrow('Invalid form choice');
    expect(() => validatePublishedFormAnswers(section, { reason: 'Other' })).toThrow('Complete: Tell us more');
    expect(() => validatePublishedFormAnswers(section, { reason: 'Consultation', unexpected: 'value' })).toThrow('Unknown form question');
  });

  it('persists only answers validated against the published form and keeps inquiry notifications generic', async () => {
    const businessRecord = { create: jest.fn().mockResolvedValueOnce({ id: 'inquiry-1' }).mockResolvedValueOnce({ id: 'notification-1' }) };
    const db: any = {
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'business-1', website: { published: { pages: [{ sections: [section] }] } } }) },
      businessRecord,
    };
    const controller = new PublicBusinessController(db);
    await expect(controller.inquiry({ data: { storeUrl: 'atelier', formId: 'contact-1', name: 'Visitor', email: 'visitor@example.test', message: 'Hello', answers: { reason: 'Other', details: 'Need an appointment' } } } as any)).resolves.toEqual({ id: 'inquiry-1' });
    expect(businessRecord.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ data: expect.objectContaining({ answers: { reason: 'Other', details: 'Need an appointment' } }) }) }));
    expect(businessRecord.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ data: { type: 'inquiry', message: 'New inquiry: Visitor' } }) }));
  });

  it('rejects tampered conditional answers before persisting anything', async () => {
    const businessRecord = { create: jest.fn() };
    const db: any = { business: { findUnique: jest.fn().mockResolvedValue({ id: 'business-1', website: { published: { pages: [{ sections: [section] }] } } }) }, businessRecord };
    const controller = new PublicBusinessController(db);
    await expect(controller.inquiry({ data: { storeUrl: 'atelier', formId: 'contact-1', name: 'Visitor', email: 'visitor@example.test', message: 'Hello', answers: { reason: 'Consultation', details: 'Hidden injection' } } } as any)).rejects.toThrow('hidden form question');
    expect(businessRecord.create).not.toHaveBeenCalled();
  });
});
