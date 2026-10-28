import { WebsiteController } from '../src/routes';
import { applyAiWebsiteOperations } from '../src/ai-website';

describe('AI website design', () => {
  const originalFetch=global.fetch;
  const originalKey=process.env.OPENAI_API_KEY;
  afterEach(()=>{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;});
  it('requests JSON explicitly and converts raw Responses output to an editable website',async()=>{
    process.env.OPENAI_API_KEY='test-only';
    global.fetch=jest.fn(async (_url,init:any)=>{
      const body=JSON.parse(init.body);
      // The provider rejects JSON mode if the input does not request JSON.
      if(body.text.format.type==='json_object'&&!/json/i.test(body.input))return {ok:false,status:400,json:async()=>({error:{code:'invalid_request_error'}})} as any;
      return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({brandName:'LUNE',sections:[{type:'hero',title:'Flowers for every moment'},{type:'collection',title:'Bouquets'},{type:'footer',title:'Contact'}]})}]}]})} as any;
    });
    const result=await new WebsiteController({} as any).aiDesign({user:{id:'test'}} as any,{prompt:'Create a luxury flower shop'});
    expect(result.model.brandName).toBe('LUNE');
    expect(result.model.pages[0].sections).toHaveLength(3);
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
});
