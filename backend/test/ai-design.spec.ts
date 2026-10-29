import { WebsiteController } from '../src/routes';
import { applyAiWebsiteOperations } from '../src/ai-website';

describe('AI website design', () => {
  const originalFetch=global.fetch;
  const originalKey=process.env.OPENAI_API_KEY;
  afterEach(()=>{jest.restoreAllMocks();global.fetch=originalFetch;if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;});
  it('requests JSON explicitly and converts raw Responses output to an editable website',async()=>{
    process.env.OPENAI_API_KEY='test-only';
    const timeoutSpy=jest.spyOn(AbortSignal,'timeout');
    global.fetch=jest.fn(async (_url,init:any)=>{
      const body=JSON.parse(init.body);
      // The provider rejects JSON mode if the input does not request JSON.
      if(body.text.format.type==='json_object'&&!/json/i.test(body.input))return {ok:false,status:400,json:async()=>({error:{code:'invalid_request_error'}})} as any;
      return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({brandName:'LUNE',sections:[{type:'hero',title:'Flowers for every moment'},{type:'about',title:'Our story'},{type:'collection',title:'Bouquets'},{type:'footer',title:'Contact'}]})}]}]})} as any;
    });
    const result=await new WebsiteController({} as any).aiDesign({user:{id:'test'}} as any,{prompt:'Create a luxury flower shop'});
    expect(timeoutSpy).toHaveBeenCalledWith(50000);
    expect(result.model.brandName).toBe('LUNE');
    expect(result.model.pages[0].sections).toHaveLength(4);
    expect(result).not.toHaveProperty('freeDesignUsed');
  });
  it('rejects a truncated design without returning a broken editor model',async()=>{
    process.env.OPENAI_API_KEY='test-only';
    global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({status:'incomplete',output:[]})});
    await expect(new WebsiteController({} as any).aiDesign({user:{id:'test'}} as any,{prompt:'Create a luxury flower shop'})).rejects.toThrow('The design was interrupted');
  });
  it('applies focused AI edits and preserves all untouched website data',async()=>{
    process.env.OPENAI_API_KEY='test-only';
    global.fetch=jest.fn(async (_url,init:any)=>{
      const body=JSON.parse(init.body);
      expect(body.text.format.type).toBe('json_object');
      expect(body.input).toContain('Existing editable website JSON');
      return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({summary:'Changed the background and enlarged the hero heading.',operations:[
        {type:'site_style',fields:{backgroundColor:'#101010'}},
        {type:'update_section',pageId:'home',sectionId:'hero',fields:{style:{fontSize:72}}}
      ]})}]}]})} as any;
    });
    const model={editorVersion:2,brandName:'LUNE',backgroundColor:'#ffffff',pages:[{id:'home',slug:'',title:'Home',sections:[{id:'hero',type:'hero',title:'Lune',body:'Flowers',style:{fontSize:48}},{id:'products',type:'collection',title:'Products',body:'Our collection'}]}]};
    const result=await new WebsiteController({} as any).aiDesign({user:{id:'test'}} as any,{prompt:'Make the background black and make the heading larger',mode:'modify',model});
    expect(result.model.backgroundColor).toBe('#101010');
    expect(result.model.pages[0].sections[0].style.fontSize).toBe(72);
    expect(result.model.pages[0].sections[1]).toEqual(model.pages[0].sections[1]);
    expect(model.backgroundColor).toBe('#ffffff');
  });
  it('does not allow the model to delete content unless the user requested deletion',()=>{
    const model={brandName:'LUNE',sections:[{id:'hero',type:'hero'},{id:'about',type:'about'}]};
    expect(()=>applyAiWebsiteOperations(model,{operations:[{type:'delete_section',sectionId:'about'}]},'Make the site more elegant')).toThrow('remove content you did not ask to remove');
  });
  it('turns gallery item output into editable image placeholders instead of rejecting the edit',()=>{
    const model={editorVersion:2,brandName:'LUNE',pages:[{id:'home',slug:'',title:'Home',sections:[{id:'hero',type:'hero',title:'Welcome'},{id:'footer',type:'footer',title:'LUNE'}]}]};
    const result=applyAiWebsiteOperations(model,{operations:[{type:'add_section',pageId:'home',afterSectionId:'hero',section:{type:'gallery',title:'Our skincare',items:[{alt:'Serum bottle'},{alt:'Face cream'},{alt:'Skincare routine'}]}}]},'Add product photos');
    const gallery=result.model.pages[0].sections.find((section:any)=>section.type==='gallery');
    expect(gallery.imagePlaceholderCount).toBe(3);
    expect(result.model.pages[0].sections.map((section:any)=>section.id)).toEqual(['hero',gallery.id,'footer']);
    expect(model.pages[0].sections).toHaveLength(2);
  });
  it('routes all seven requested edit prompts through the AI response parser into editable changes',async()=>{
    process.env.OPENAI_API_KEY='test-only';
    const model={editorVersion:2,brandName:'LUNE',backgroundColor:'#f5f2ea',textColor:'#171513',pages:[{id:'home',slug:'',title:'Home',sections:[
      {id:'hero',type:'hero',title:'Lune',body:'Skincare',style:{fontSize:56}},
      {id:'products',type:'collection',title:'The collection',body:'Explore the products'},
      {id:'contact',type:'contact',title:'Contact',body:'Get in touch'},
      {id:'footer',type:'footer',title:'Lune',body:'Footer'}
    ]}]};
    const cases:Array<{prompt:string;output:Record<string,any>;verify:(website:Record<string,any>)=>void}>=[
      {prompt:'Add a product gallery with six products.',output:{operations:[{type:'add_section',pageId:'home',afterSectionId:'hero',section:{type:'collection',title:'Six products',body:'Explore our collection',limit:6}}]},verify:website=>{const section=website.pages[0].sections.find((item:any)=>item.type==='collection'&&item.limit===6);expect(section).toBeTruthy();}},
      {prompt:'Change the background to black.',output:{operations:[{type:'site_style',fields:{backgroundColor:'#000000',textColor:'#ffffff'}}]},verify:website=>{expect(website.backgroundColor).toBe('#000000');expect(website.textColor).toBe('#ffffff');}},
      {prompt:'Move the contact section above the footer.',output:{operations:[{type:'move_section',pageId:'home',sectionId:'contact',beforeSectionId:'footer'}]},verify:website=>{const sections=website.pages[0].sections;expect(sections.findIndex((item:any)=>item.id==='contact')).toBeLessThan(sections.findIndex((item:any)=>item.id==='footer'));}},
      {prompt:'Make the website mobile-friendly.',output:{operations:[{type:'update_section',pageId:'home',sectionId:'hero',fields:{responsive:{phone:{fontSize:32,paddingY:32,maxWidth:420},ipad:{fontSize:42,paddingY:48}}}}]},verify:website=>{expect(website.pages[0].sections[0].responsive.phone.fontSize).toBe(32);expect(website.pages[0].sections[0].responsive.ipad.paddingY).toBe(48);}},
      {prompt:'Make the main heading bigger and center it.',output:{operations:[{type:'update_section',pageId:'home',sectionId:'hero',fields:{style:{fontSize:76,textAlign:'center'}}}]},verify:website=>{expect(website.pages[0].sections[0].style.fontSize).toBe(76);expect(website.pages[0].sections[0].style.textAlign).toBe('center');}},
      {prompt:'Add a new FAQ section above the footer.',output:{operations:[{type:'add_section',pageId:'home',afterSectionId:'contact',section:{type:'faq',title:'Frequently asked questions',body:'Answers to common questions.',items:[{question:'How do I use these products?',answer:'Add your verified product instructions here.'}]}}]},verify:website=>{const sections=website.pages[0].sections;const faq=sections.findIndex((item:any)=>item.type==='faq');expect(faq).toBeGreaterThan(sections.findIndex((item:any)=>item.id==='contact'));expect(faq).toBeLessThan(sections.findIndex((item:any)=>item.id==='footer'));}},
      {prompt:'Add a new section explaining our skincare products.',output:{operations:[{type:'add_section',pageId:'home',afterSectionId:'products',section:{type:'about',label:'Our skincare',title:'A thoughtful skincare routine',body:'Add verified information about your ingredients, use, and routine here.'}}]},verify:website=>{expect(website.pages[0].sections.some((item:any)=>item.label==='Our skincare')).toBe(true);}},
      {prompt:'Remove the second section.',output:{operations:[{type:'delete_section',pageId:'home',sectionId:'products'}]},verify:website=>{expect(website.pages[0].sections.map((item:any)=>item.id)).toEqual(['hero','contact','footer']);}},
    ];
    for(const {prompt,output,verify} of cases){
      global.fetch=jest.fn(async (_url,init:any)=>{
        const request=JSON.parse(init.body);
        expect(request.input).toContain(prompt);
        expect(request.input).toContain('Existing editable website JSON');
        return {ok:true,json:async()=>({status:'completed',output_text:JSON.stringify(output)})} as any;
      });
      const result=await new WebsiteController({} as any).aiDesign({user:{id:'test'}} as any,{prompt,mode:'modify',model});
      verify(result.model);
      expect(result.model.pages[0].sections.some((item:any)=>item.id==='hero')).toBe(true);
    }
  });
  it('creates an editable beige luxury skincare website from the requested prompt',async()=>{
    process.env.OPENAI_API_KEY='test-only';
    const generated={brandName:'LUNE SKIN',primaryColor:'#a6957b',backgroundColor:'#ffffff',textColor:'#211d18',headingFont:'Georgia',bodyFont:'Arial',sections:[
      {type:'hero',title:'Ritual, refined',body:'Thoughtful skincare for daily rituals.'},
      {type:'about',title:'Care in every detail',body:'Created for a considered routine.'},
      {type:'gallery',title:'Skincare imagery',body:'Add your product and lifestyle photography.',imagePlaceholderCount:3},
      {type:'collection',title:'The collection',body:'Explore our products.'},
      {type:'contact',title:'Get in touch',body:'Questions about your routine?'},
      {type:'footer',title:'Lune Skin',body:'Skincare, considered.'}
    ]};
    global.fetch=jest.fn(async (_url,init:any)=>{
      const request=JSON.parse(init.body);
      expect(request.input).toContain('Create a luxury skincare website with beige and white colors.');
      expect(request.instructions).toContain('imagePlaceholderCount:3');
      expect(request.text.format.type).toBe('json_object');
      return {ok:true,json:async()=>({status:'completed',output_text:JSON.stringify(generated)})} as any;
    });
    const result=await new WebsiteController({} as any).aiDesign({user:{id:'test'}} as any,{prompt:'Create a luxury skincare website with beige and white colors.'});
    expect(result.model.backgroundColor).toBe('#ffffff');
    expect(result.model.pages[0].sections.map((section:any)=>section.type)).toContain('collection');
    expect(result.model.pages[0].sections.map((section:any)=>section.type)).toContain('contact');
    expect(result.model.pages[0].sections.find((section:any)=>section.type==='gallery').imagePlaceholderCount).toBe(3);
  });
  it('rejects malformed responsive values and out-of-range product limits without changing the source model',()=>{
    const model={brandName:'LUNE',pages:[{id:'home',slug:'',title:'Home',sections:[{id:'products',type:'collection',title:'Products',body:''}]}]};
    expect(()=>applyAiWebsiteOperations(model,{operations:[{type:'update_section',pageId:'home',sectionId:'products',fields:{limit:25}}]},'Show more products')).toThrow('invalid product collection size');
    expect(()=>applyAiWebsiteOperations(model,{operations:[{type:'update_section',pageId:'home',sectionId:'products',fields:{responsive:{tablet:{fontSize:30}}}}]},'Make it responsive')).toThrow('invalid responsive settings');
    expect(model.pages[0].sections[0]).not.toHaveProperty('limit');
  });
  it('asks for a specific section before an ambiguous deletion and keeps the source website intact',()=>{
    const model={brandName:'LUNE',pages:[{id:'home',slug:'',title:'Home',sections:[{id:'hero',type:'hero',title:'Welcome',label:'Hero'},{id:'story',type:'about',title:'Our Story',label:'About'},{id:'footer',type:'footer',title:'Contact',label:'Footer'}]}]};
    expect(()=>applyAiWebsiteOperations(model,{operations:[{type:'delete_section',pageId:'home',sectionId:'story'}]},'Remove a section')).toThrow('specify the section by its title or position');
    expect(model.pages[0].sections).toHaveLength(3);
  });
  it('does not insert a new section at the start when its requested anchor is missing',()=>{
    const model={brandName:'LUNE',pages:[{id:'home',slug:'',title:'Home',sections:[{id:'hero',type:'hero',title:'Welcome'}]}]};
    expect(()=>applyAiWebsiteOperations(model,{operations:[{type:'add_section',pageId:'home',afterSectionId:'missing',section:{type:'faq',title:'FAQ'}}]},'Add an FAQ')).toThrow('referenced a missing section');
    expect(model.pages[0].sections).toHaveLength(1);
  });
  it('keeps a missing provider key explicit and reports AI as unavailable',async()=>{
    delete process.env.OPENAI_API_KEY;
    const fetchSpy=jest.fn();global.fetch=fetchSpy as any;
    const controller=new WebsiteController({} as any);
    expect(await controller.aiStatus()).toEqual({available:false,usageLimited:false});
    await expect(controller.aiDesign({user:{id:'test'}} as any,{prompt:'Create a luxury skincare website'})).rejects.toThrow('OPENAI_API_KEY is not configured on the API service');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('normalizes a non-JSON upstream error without exposing provider response details',async()=>{
    process.env.OPENAI_API_KEY='test-only';
    global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>{throw new Error('upstream body unavailable')},headers:{get:()=>null}});
    await expect(new WebsiteController({} as any).aiDesign({user:{id:'test'}} as any,{prompt:'Create a luxury skincare website'})).rejects.toThrow('AI returned an unreadable response');
  });
  it.each([
    [401,'AI connection needs attention'],
    [429,'AI is temporarily busy or its API balance is unavailable'],
  ])('returns a safe actionable message for provider HTTP %s',async(status,message)=>{
    process.env.OPENAI_API_KEY='test-only';
    global.fetch=jest.fn().mockResolvedValue({ok:false,status,json:async()=>({error:{code:'provider_code',message:'private provider detail'}}),headers:{get:()=> 'request-id'}});
    await expect(new WebsiteController({} as any).aiDesign({user:{id:'test'}} as any,{prompt:'Create a luxury skincare website'})).rejects.toThrow(message as string);
  });
  it('keeps the existing model unchanged after a provider network failure',async()=>{
    process.env.OPENAI_API_KEY='test-only';
    global.fetch=jest.fn().mockRejectedValue(Object.assign(new Error('timeout'),{name:'TimeoutError'}));
    const model={editorVersion:2,brandName:'LUNE',backgroundColor:'#ffffff',pages:[{id:'home',slug:'',title:'Home',sections:[{id:'hero',type:'hero',title:'Welcome',body:'Existing copy'}]}]};
    await expect(new WebsiteController({} as any).aiDesign({user:{id:'test'}} as any,{prompt:'Make the heading bigger',mode:'modify',model})).rejects.toThrow('Your current website was not changed');
    expect(model.pages[0].sections[0].title).toBe('Welcome');
  });
});
