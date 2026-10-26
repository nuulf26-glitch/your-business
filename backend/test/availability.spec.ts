import { allocate } from '../src/availability';

const everyDay={0:{open:'00:00',close:'23:59'},1:{open:'00:00',close:'23:59'},2:{open:'00:00',close:'23:59'},3:{open:'00:00',close:'23:59'},4:{open:'00:00',close:'23:59'},5:{open:'00:00',close:'23:59'},6:{open:'00:00',close:'23:59'}};

describe('booking availability',()=>{
  it('does not offer a staff member with an overlapping confirmed booking',()=>{
    const start=Date.parse('2030-06-03T10:00:00.000Z');
    const catalog={timeZone:'UTC',hours:everyDay,services:[{id:'cut',name:'Cut',duration:30,price:40}],staff:[{id:'staff-1',active:true,serviceIds:['cut'],hours:everyDay,breaks:[]}]};
    expect(()=>allocate(catalog,{kind:'appointment',serviceId:'cut',start:new Date(start).toISOString()},[{status:'confirmed',staffId:'staff-1',start:new Date(start).toISOString(),end:new Date(start+30*60000).toISOString()}],start-1000)).toThrow('No staff member is available');
  });

  it('selects the smallest table that can fit a reservation',()=>{
    const start=Date.parse('2030-06-03T10:00:00.000Z');
    const catalog={timeZone:'UTC',hours:everyDay,reservationDuration:60,tables:[{id:'large',capacity:8},{id:'small',capacity:4}]};
    expect(allocate(catalog,{kind:'reservation',guests:3,start:new Date(start).toISOString()},[],start-1000).tableId).toBe('small');
  });
});
