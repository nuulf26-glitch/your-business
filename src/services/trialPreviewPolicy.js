export function updatePreviewBrandName(model, brandName) {
  return {
    ...model,
    brandName,
    pages: (model.pages || []).map(page => ({
      ...page,
      sections: (page.sections || []).map(section => section.type === 'footer'
        ? { ...section, title: brandName }
        : section),
    })),
  };
}
