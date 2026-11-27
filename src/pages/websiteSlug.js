export function websiteSlug(value = "") {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

export function suggestedWebsiteSlug(businessName = "") {
  return websiteSlug(businessName) || (businessName.trim() ? "my-business" : "");
}
