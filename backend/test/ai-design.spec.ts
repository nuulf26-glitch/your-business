import { WebsiteController } from '../src/routes';

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
    expect(result.freeDesignUsed).toBe(false);
  });
  it('rejects a truncated design without returning a broken editor model',async()=>{
    process.env.OPENAI_API_KEY='test-only';
    global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({status:'incomplete',output:[]})});
    await expect(new WebsiteController({} as any).aiDesign({user:{id:'test'}} as any,{prompt:'Create a luxury flower shop'})).rejects.toThrow('The design was interrupted');
  });
});
