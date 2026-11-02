import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBooking} from '../public/booking.js';
import {createHistory} from '../public/search-history.js';
test('dated booking requires selections while course remains compatible',()=>{
 const booking=createBooking({state:{services:[{id:'t1',type:'tutor',price:120},{id:'c1',type:'course'}]},api:()=>{},esc:String,toast:()=>{}});
 const markup=booking.fields({id:'t1'});assert.ok(markup.includes('type="date"'));assert.throws(()=>booking.serialize({},'t1'),/至少选择/);assert.doesNotThrow(()=>booking.serialize({},'c1'));
});
test('history deduplicates, limits, deletes and clears',()=>{
 const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const h=createHistory({esc:String});h.save('英语');h.save('英语');assert.equal((h.view().match(/data-history-query/g)||[]).length,1);h.save('编程');h.remove(0);assert.ok(!h.view().includes('编程'));h.clear();assert.equal(h.view(),'');delete globalThis.localStorage;
});
