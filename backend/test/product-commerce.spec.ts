import { ProductController } from '../src/routes';
import { productDataValidationError } from '../src/product-policy';

describe('product commerce validation and lifecycle', () => {
  it('rejects invalid prices and fractional stock in server-side product payloads', () => {
    expect(productDataValidationError({ name: 'Item', sellingPrice: '-1' })).toContain('sellingPrice');
    expect(productDataValidationError({ name: 'Item', stock: '1.5' })).toContain('Stock');
    expect(productDataValidationError({ name: 'Item', variants: [{ name: 'Small', price: 'NaN' }] })).toContain('Variant 1 price');
    expect(productDataValidationError({ name: 'Item', sellingPrice: '12.50', stock: '4', variants: [{ name: 'Small', price: '10', stock: 2 }] })).toBeNull();
  });

  it('does not duplicate a product outside the authenticated merchant business', async () => {
    const tx:any={};
    const db:any={
      business:{findFirst:jest.fn().mockResolvedValue({id:'business-owned'})},
      product:{findFirst:jest.fn().mockResolvedValue(null),create:jest.fn()},
    };
    await expect(new ProductController(db).duplicate({user:{id:'owner-1'},params:{id:'other-business-product'}} as any)).rejects.toThrow('Product not found');
    expect(db.product.findFirst).toHaveBeenCalledWith({where:{id:'other-business-product',businessId:'business-owned'}});
    expect(db.product.create).not.toHaveBeenCalled();
  });

  it('rejects invalid product pricing before persisting it', async () => {
    const db:any={
      business:{findFirst:jest.fn().mockResolvedValue({id:'business-owned'})},
      product:{create:jest.fn()},
    };
    await expect(new ProductController(db).create({user:{id:'owner-1'}} as any,{data:{name:'Item',sellingPrice:'-5'}} as any)).rejects.toThrow('sellingPrice');
    expect(db.product.create).not.toHaveBeenCalled();
  });
});
