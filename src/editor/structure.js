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
export function mediaAssets(model){
 const found=new Set();
 function visit(section){if(section.image)found.add(section.image);for(const image of section.images||[])if(image)found.add(image);for(const item of section.media||[])if(item.url)found.add(item.url);for(const item of section.items||[])visit(item);for(const child of section.children||[])visit(child);}
 for(const page of model.pages||[{sections:model.sections||[]}])for(const section of page.sections)visit(section);
 if(model.logo)found.add(model.logo);
 return [...found];
}
