import { ProductController } from '../src/routes';
import { validateWebsite } from '../src/website-policy';
describe('product updates and published media',()=>{
 it('preserves name, price and media during a status-only update and scopes it to the owner',async()=>{
  const data={name:'Flowers',sellingPrice:25,stock:3,media:[{type:'video',url:'https://example.com/a.mp4'}]};
  const db:any={business:{findFirst:jest.fn().mockResolvedValue({id:'business'})},product:{findFirst:jest.fn().mockResolvedValue({id:'product',name:'Flowers',data}),updateMany:jest.fn().mockResolvedValue({count:1}),findUnique:jest.fn().mockResolvedValue({id:'product'})}};
  await new ProductController(db).update({user:{id:'owner'},params:{id:'product'}} as any,{data:{status:'hidden'}});
  expect(db.product.findFirst).toHaveBeenCalledWith({where:{id:'product',businessId:'business'}});
  expect(db.product.updateMany).toHaveBeenCalledWith({where:{id:'product',businessId:'business'},data:{name:'Flowers',data:{...data,status:'hidden'}}});
 });
 it('allows uploaded photos and videos to publish with their display dimensions',()=>{
  const model={brandName:'LUNE',pages:[{id:'home',slug:'',sections:[{id:'media',type:'menu',image:'/api/v1/uploads/businesses/user/abc',media:[{type:'image',url:'/api/v1/uploads/businesses/user/abc',width:50,unit:'%'}],items:[{name:'Bouquet',media:[{type:'video',url:'https://example.com/a.mp4',height:240}]}]}]}]};
  expect(validateWebsite(model).pages[0].sections[0].items[0].media[0].height).toBe(240);
  model.pages[0].sections[0].items[0].media[0].url='javascript:alert(1)';
  expect(()=>validateWebsite(model)).toThrow('safe HTTPS media URL');
 });
});
