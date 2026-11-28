function sectionsFor(model) {
  if (Array.isArray(model?.pages) && model.pages.length) return model.pages.flatMap(page => Array.isArray(page.sections) ? page.sections : []);
  return Array.isArray(model?.sections) ? model.sections : [];
}

function collectProductReferences(sections, references = new Map()) {
  for (const section of sections) {
    if (section?.type === "product" && section.id && section.productId) references.set(section.id, section.productId);
    if (Array.isArray(section?.children)) collectProductReferences(section.children, references);
  }
  return references;
}

function restoreSectionProductReferences(sections, references) {
  let changed = false;
  const next = sections.map(section => {
    const productId = section?.type === "product" ? references.get(section.id) : undefined;
    const children = Array.isArray(section?.children) ? restoreSectionProductReferences(section.children, references) : section?.children;
    const restoreId = productId && section.productId !== productId;
    const restoreChildren = children !== section.children;
    if (!restoreId && !restoreChildren) return section;
    changed = true;
    return { ...section, ...(restoreId ? { productId } : {}), ...(restoreChildren ? { children } : {}) };
  });
  return changed ? next : sections;
}

export function preserveProductReferences(sourceModel, proposedModel) {
  const references = collectProductReferences(sectionsFor(sourceModel));
  if (!references.size || !proposedModel || typeof proposedModel !== "object") return proposedModel;

  if (Array.isArray(proposedModel.pages) && proposedModel.pages.length) {
    let changed = false;
    const pages = proposedModel.pages.map(page => {
      if (!Array.isArray(page.sections)) return page;
      const sections = restoreSectionProductReferences(page.sections, references);
      if (sections === page.sections) return page;
      changed = true;
      return { ...page, sections };
    });
    if (!changed) return proposedModel;
    return { ...proposedModel, pages, ...(Array.isArray(proposedModel.sections) ? { sections: pages[0].sections } : {}) };
  }

  const sections = restoreSectionProductReferences(sectionsFor(proposedModel), references);
  return sections === proposedModel.sections ? proposedModel : { ...proposedModel, sections };
}
