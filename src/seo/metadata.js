export const origin = 'https://getcyb.fit';
export const pages = {
  '/': ['CYB | Business Website Builder', 'Build and publish a business website with CYB. Manage your store, bookings and customer relationships in one workspace.', 'WebSite'],
  '/about': ['About CYB', 'Learn how CYB brings website creation, publishing and business management together for independent businesses.', 'AboutPage'],
  '/contact': ['Contact CYB Support', 'Contact the CYB team for help with your account, website, product questions or privacy requests.', 'ContactPage'],
  '/pricing': ['CYB Pricing | Lifetime Access', 'Explore lifetime access to the CYB website builder and the tools included for running your business.'],
  '/templates': ['Website Templates | CYB', 'Explore Modern Style and Luxury Dark website templates for stores, brands and professional services.'],
  '/terms': ['Terms of Service | CYB', 'Read the terms that apply to CYB accounts, website creation and use of the platform.'],
  '/privacy': ['Privacy Policy | CYB', 'Learn how CYB handles personal information and how to contact the team about privacy.'],
};
export function platform(path) {
  const key = path.replace(/\/+$/, '') || '/';
  const row = Object.hasOwn(pages, key) && pages[key];
  return row && {title:row[0], description:row[1], type:row[2] || 'WebPage', url:origin + key, image:origin + '/images/hero-business.jpg'};
}
export function tags(data, indexable) {
  const elements = [['title', {}, data?.title || 'CYB']];
  elements.push(['meta', {name:'robots', content:indexable && data ? 'index, follow' : 'noindex, follow'}]);
  if (!data) return elements;
  elements.push(['link', {rel:'canonical', href:data.url}]);
  if (data.description) elements.push(['meta', {name:'description', content:data.description}]);
  for (const [name, content] of Object.entries({title:data.title, description:data.description, url:data.url, type:data.type === 'Article' ? 'article' : 'website', image:data.image})) {
    if (content) elements.push(['meta', {property:'og:' + name, content}]);
  }
  elements.push(['meta', {name:'twitter:card', content:data.image ? 'summary_large_image' : 'summary'}]);
  elements.push(['script', {type:'application/ld+json'}, JSON.stringify({'@context':'https://schema.org','@type':data.type || 'WebPage', name:data.title,url:data.url,description:data.description}).replace(/</g,'\\u003c')]);
  return elements;
}
export function customerPage(model, page, path) {
  const image = /^https?:\/\//i.test(page.socialImage || '') ? page.socialImage : undefined;
  return {title:page.seoTitle || [page.title,model.brandName].filter(Boolean).join(' — ') || 'Website', description:page.description || model.description, image, url:origin + path, type:'WebPage'};
}
