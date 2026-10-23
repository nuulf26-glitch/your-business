export const DESIGN_COLLECTIONS = [
  { id: 'atelier', name: 'Atelier Beauty', category: 'salon', variant: 'luxury', ink: '#302b25', paper: '#f0eade', accent: '#514a3d', title: 'A little time. Entirely yours.', body: 'A considered approach to beauty. Discover our treatments and the people behind them.', eyebrow: 'Beauty, with intention', services: ['Hair & colour', 'Skin rituals', 'Nails & finishing'], about: 'Good care begins with listening.' },
  { id: 'supper', name: 'Supper Club', category: 'restaurant', variant: 'editorial', ink: '#e6c3a0', paper: '#282923', accent: '#a8603e', title: 'Come hungry. Stay a little longer.', body: 'Seasonal plates, familiar faces and a table worth gathering around.', eyebrow: 'At the table', services: ['Seasonal plates', 'From the bar', 'Private gatherings'], about: 'A place for the everyday occasion.' },
  { id: 'form', name: 'Form & Field', category: 'store', variant: 'commerce', ink: '#25251f', paper: '#f5f3ec', accent: '#655b43', title: 'Objects for the way you live.', body: 'Considered essentials. Lasting materials. A collection made to become part of your everyday.', eyebrow: 'The considered collection', services: ['Everyday essentials', 'New perspectives', 'Objects to keep'], about: 'Fewer things. Better stories.' },
  { id: 'index', name: 'Independent Index', category: 'portfolio', variant: 'studio', ink: '#171717', paper: '#fafafa', accent: '#1a1a1a', title: 'Ideas into things that matter.', body: 'Independent practice. Selected work. An ongoing exploration of form, culture and possibility.', eyebrow: 'Independent creative practice', services: ['Creative direction', 'Identity & design', 'Digital experiences'], about: 'A practice built on curiosity.' },
];
export function collectionSections(collection, createSection) {
  const hero = { ...createSection('hero'), title: collection.title, body: collection.body, eyebrow: collection.eyebrow, variant: collection.variant, buttonText: 'Explore', href: '#collection-story' };
  const about = { ...createSection('about'), anchor: 'collection-story', title: collection.about, body: 'Share the story of your business here. Replace this text with the details that make your work yours.', variant: collection.variant };
  const services = { ...createSection(collection.category === 'restaurant' ? 'menu' : 'services'), title: collection.category === 'restaurant' ? 'At the table' : 'Our focus', ...(collection.category === 'restaurant' ? {} : { items: collection.services }) };
  about.anchor = about.id; hero.href = `#${about.id}`;
  return [hero, about, services].map(section => ({ ...section, style: { ...section.style, color: collection.ink, fontFamily: collection.variant === 'studio' ? 'Arial' : 'Georgia' } }));
}

export function collectionWebsite(collection, createSection) {
  const sections = collectionSections(collection, createSection);
  const contact = { ...createSection('contact'), title: 'Every good thing starts with a conversation.', body: 'Send your question or tell us what you have in mind.' };
  const detailType = collection.category === 'restaurant' ? 'menu' : collection.category === 'store' ? 'collection' : collection.category === 'portfolio' ? 'gallery' : 'services';
  const detail = { ...createSection(detailType), title: collection.category === 'restaurant' ? 'A taste of the season.' : collection.category === 'store' ? 'The collection.' : collection.category === 'portfolio' ? 'Selected work.' : 'Care, considered.', dataSource:'catalog' };
  const booking = { ...createSection('booking'), title: collection.category === 'restaurant' ? 'A seat at our table.' : 'Make time for yourself.', body: 'Choose the date and time that work for you.' };
  const footer = { ...createSection('footer'), title: collection.name, body: 'Add your address, opening hours and contact details.' };
  return { editorVersion:2,brandName:collection.name,backgroundColor:collection.paper,textColor:collection.ink,primaryColor:collection.accent,sections,
    pages:[
      {id:'home',title:'Home',slug:'',sections:[...sections,{...footer,id:`${footer.id}-home`}]},
      {id:'offering',title:collection.category==='restaurant'?'Menu':collection.category==='store'?'Shop':collection.category==='portfolio'?'Work':'Services',slug:collection.category==='restaurant'?'menu':collection.category==='store'?'shop':collection.category==='portfolio'?'work':'services',sections:[detail,...(['salon','restaurant'].includes(collection.category)?[booking]:[]),{...footer,id:`${footer.id}-offering`}]},
      {id:'story',title:'About',slug:'about',sections:[{...sections[1],id:`${sections[1].id}-story`,anchor:undefined},{...createSection('text'),body:collection.body},{...footer,id:`${footer.id}-story`}]},
      {id:'contact',title:'Contact',slug:'contact',sections:[contact,{...footer,id:`${footer.id}-contact`}]}
    ] };
}
