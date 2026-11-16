export function groupSections(sections,ids,id){
 const chosen=sections.filter(section=>ids.includes(section.id));
 if(chosen.length<2)throw Error('Select at least two sections.');
 if(chosen.some(section=>section.locked))throw Error('Unlock selected sections first.');
 const index=sections.findIndex(section=>ids.includes(section.id));
 const rest=sections.filter(section=>!ids.includes(section.id));
 rest.splice(index,0,{id,type:'group',label:'Group',title:'Grouped sections',children:chosen,style:{paddingY:0}});
 return rest;
}
export function ungroupSections(sections,id){
 const target=sections.find(section=>section.id===id);
 if(target?.type!=='group'||target.locked)throw Error('Select an unlocked group.');
 return sections.flatMap(section=>section.id===id?section.children:section);
}
export function findSection(sections,id){
 for(const section of sections||[]){if(section.id===id)return section;const nested=findSection(section.children,id);if(nested)return nested;}
 return null;
}
export function sectionSiblings(sections,id){
 const list=sections||[];if(list.some(section=>section.id===id))return list;
 for(const section of list){const nested=sectionSiblings(section.children,id);if(nested)return nested;}
 return null;
}
export function insertAfterSection(sections,id,incoming){
 let changed=false;const list=sections||[];const index=list.findIndex(section=>section.id===id);
 if(index>=0){const next=[...list];next.splice(index+1,0,incoming);return next;}
 const next=list.map(section=>{if(!Array.isArray(section.children))return section;const children=insertAfterSection(section.children,id,incoming);if(children!==section.children){changed=true;return {...section,children};}return section;});return changed?next:sections;
}
export function updateNestedSection(sections,id,update){
 let changed=false;
 const next=(sections||[]).map(section=>{
  if(section.id===id){changed=true;return update(section);}
  if(Array.isArray(section.children)){const children=updateNestedSection(section.children,id,update);if(children!==section.children){changed=true;return {...section,children};}}
  return section;
 });
 return changed?next:sections;
}
export function reorderNestedSection(sections,movingId,targetId,position='before'){
 if(!movingId||!targetId||movingId===targetId)return sections;
 const list=sections||[];const from=list.findIndex(section=>section.id===movingId);const to=list.findIndex(section=>section.id===targetId);
 if(from>=0&&to>=0){if(list[from].locked)throw Error('Unlock this section before moving it.');const next=[...list];const [moved]=next.splice(from,1);const target=next.findIndex(section=>section.id===targetId);next.splice(target+(position==='after'?1:0),0,moved);return next;}
 let changed=false;const next=list.map(section=>{if(!Array.isArray(section.children))return section;const children=reorderNestedSection(section.children,movingId,targetId,position);if(children!==section.children){changed=true;return {...section,children};}return section;});
 return changed?next:sections;
}
export function removeNestedSection(sections,id){
 let changed=false;const next=(sections||[]).flatMap(section=>{if(section.id===id){changed=true;return [];}if(Array.isArray(section.children)){const children=removeNestedSection(section.children,id);if(children!==section.children){changed=true;return [{...section,children}];}}return [section];});return changed?next:sections;
}
export function mediaAssets(model){
 const found=new Set();
 function visit(section){if(section.image)found.add(section.image);for(const image of section.images||[])if(image)found.add(image);for(const item of section.media||[])if(item.url)found.add(item.url);for(const item of section.items||[])visit(item);for(const child of section.children||[])visit(child);}
 for(const page of model.pages||[{sections:model.sections||[]}])for(const section of page.sections)visit(section);
 if(model.logo)found.add(model.logo);
 return [...found];
}
