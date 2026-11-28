import {origin,tags} from './metadata.js';

export function setDocumentSeo(data) {
  document.head.querySelectorAll('[data-cyb-seo]').forEach(node => node.remove());
  const live = import.meta.env.VITE_CYB_INDEXABLE && location.origin === origin;
  for (const [tag,attrs,value] of tags(data,live)) {
    const node = document.createElement(tag);
    node.dataset.cybSeo = '';
    for (const [key,content] of Object.entries(attrs)) node.setAttribute(key,content);
    if (value !== undefined) node.textContent = value;
    document.head.append(node);
  }
}
