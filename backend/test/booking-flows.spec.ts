import { BusinessController, PublicBusinessController } from '../src/routes';

const hours=Object.fromEntries(Array.from({length:7},(_,day)=>[day,{open:'09:00',close:'17:00'}]));
const catalog={businessCategory:'services',timeZone:'Asia/Dubai',hours,services:[{id:'consult',name:'Consultation',duration:30,price:50}],staff:[{id:'staff-1',name:'Amina',active:true,serviceIds:['consult']}]};
const business={id:'merchant-1',ownerId:'owner-1',slug:'studio-test',settings:{businessCatalog:catalog}};
const futureDate=()=>new Date(Date.now()+20*86400000).toISOString().slice(0,10);

describe('booking lifecycle routes',()=>{
  it('creates a manual appointment only for an available slot and stores its business-local date',async()=>{
    const created={id:'booking-1',status:'confirmed'};
    const tx:any={
      $queryRaw:jest.fn(),
      businessRecord:{findMany:jest.fn().mockResolvedValue([]),create:jest.fn().mockResolvedValue(created)},
    };
    const db:any={business:{findFirst:jest.fn().mockResolvedValue(business)},$transaction:jest.fn(callback=>callback(tx))};
    const date=futureDate(),start=`${date}T05:00:00.000Z`;
    const result=await new BusinessController(db).createOwnerBooking({user:{id:'owner-1'},headers:{}} as any,{data:{storeUrl:'studio-test',name:'Synthetic Customer',email:'qa@example.test',start,serviceId:'consult',kind:'appointment'}} as any);
    expect(result).toMatchObject({id:'booking-1',start,end:new Date(Date.parse(start)+30*60000).toISOString(),status:'confirmed',timeZone:'Asia/Dubai'});
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.businessRecord.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({businessId:'merchant-1',type:'bookings',data:expect.objectContaining({name:'Synthetic Customer',email:'qa@example.test',serviceName:'Consultation',date})})}));
  });

  it('rejects manual appointments outside business hours without writing a booking',async()=>{
    const tx:any={
      $queryRaw:jest.fn(),
      businessRecord:{findMany:jest.fn().mockResolvedValue([]),create:jest.fn()},
    };
    const db:any={business:{findFirst:jest.fn().mockResolvedValue(business)},$transaction:jest.fn(callback=>callback(tx))};
    await expect(new BusinessController(db).createOwnerBooking({user:{id:'owner-1'},headers:{}} as any,{data:{storeUrl:'studio-test',name:'Synthetic Customer',email:'qa@example.test',start:`${futureDate()}T03:00:00.000Z`,serviceId:'consult',kind:'appointment'}} as any)).rejects.toThrow('No staff member is available');
    expect(tx.businessRecord.create).not.toHaveBeenCalled();
  });

  it('returns public availability and creates a confirmed appointment in the business timezone',async()=>{
    const date=futureDate(),publicBusiness={...business,website:{published:{}}};
    const tx:any={$queryRaw:jest.fn(),businessRecord:{findMany:jest.fn().mockResolvedValue([]),create:jest.fn().mockResolvedValue({id:'public-booking-1',status:'confirmed'})}};
    const db:any={business:{findUnique:jest.fn().mockResolvedValue(publicBusiness)},businessRecord:{findMany:jest.fn().mockResolvedValue([])},$transaction:jest.fn(callback=>callback(tx))};
    const controller=new PublicBusinessController(db);
    const options=await controller.bookingOptions({data:{storeUrl:'studio-test',date,serviceId:'consult',kind:'appointment'}} as any);
    expect(options.length).toBeGreaterThan(0);
    const slot=options.find((item:any)=>new Date(item.start).toISOString().endsWith('T05:00:00.000Z'));
    if(!slot)throw new Error('Expected a public slot at 9:00 AM in the business timezone.');
    const result=await controller.createBooking({data:{storeUrl:'studio-test',name:'Synthetic Visitor',email:'visitor@example.test',start:slot.start,serviceId:'consult',kind:'appointment'}} as any);
    expect(result).toMatchObject({id:'public-booking-1',start:slot.start,status:'confirmed',timeZone:'Asia/Dubai'});
    expect(tx.businessRecord.create).toHaveBeenCalledTimes(2);
    expect(tx.businessRecord.create.mock.calls[0][0].data.data).toMatchObject({serviceName:'Consultation',date});
  });

  it('reschedules within merchant scope using the saved service and configured timezone',async()=>{
    const date=futureDate(),start=`${date}T05:00:00.000Z`,rescheduledStart=`${date}T06:00:00.000Z`;
    const current={id:'booking-1',businessId:'merchant-1',type:'bookings',status:'confirmed',data:{kind:'appointment',serviceId:'consult',serviceName:'Consultation',staffId:'staff-1',start,end:new Date(Date.parse(start)+30*60000).toISOString()}};
    const updated={...current,data:{...current.data,start:rescheduledStart}};
    const tx:any={$queryRaw:jest.fn(),businessRecord:{findMany:jest.fn().mockResolvedValue([current]),update:jest.fn().mockResolvedValue(updated)}};
    const db:any={business:{findFirst:jest.fn().mockResolvedValue(business)},businessRecord:{findFirst:jest.fn().mockResolvedValue(current)},$transaction:jest.fn(callback=>callback(tx))};
    const req:any={user:{id:'owner-1'},headers:{},params:{id:'booking-1'}};
    const result=await new BusinessController(db).rescheduleBooking(req,{data:{start:rescheduledStart}} as any);
    expect((result.data as any).start).toBe(rescheduledStart);
    expect(db.businessRecord.findFirst).toHaveBeenCalledWith({where:{id:'booking-1',businessId:'merchant-1',type:'bookings',status:'confirmed'}});
    expect(tx.businessRecord.update).toHaveBeenCalledWith(expect.objectContaining({where:{id:'booking-1'},data:{data:expect.objectContaining({start:rescheduledStart,date})}}));
  });

  it('cancels bookings through a merchant-scoped update',async()=>{
    const db:any={business:{findFirst:jest.fn().mockResolvedValue(business)},businessRecord:{updateMany:jest.fn().mockResolvedValue({count:1})}};
    const result=await new BusinessController(db).updateRecord({user:{id:'owner-1'},headers:{},params:{id:'booking-1'},query:{type:'bookings'}} as any,{status:'cancelled'} as any);
    expect(result).toEqual({success:true});
    expect(db.businessRecord.updateMany).toHaveBeenCalledWith({where:{id:'booking-1',businessId:'merchant-1',type:'bookings'},data:{status:'cancelled'}});
  });
});
