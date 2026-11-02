import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'education-test-'));
const child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{env:{...process.env,PORT:'3199',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('Server exited '+code)));});
after(async()=>{const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;await rm(dir,{recursive:true,force:true});});
async function call(p,method='GET',data){const r=await fetch('http://127.0.0.1:3199/api'+p,{method,headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,data:await r.json()};}
/* 实际日期排期工具：与服务端一致，按中国日期（Asia/Shanghai）计算 */
const CN_WEEK=['周日','周一','周二','周三','周四','周五','周六'];
const cnToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const shiftDate=(date,n)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const weekdayOf=date=>CN_WEEK[new Date(date+'T00:00:00Z').getUTCDay()];
// 从今天起向后找目标星期的日期（不早于今天）
function nextWeekday(label,minOffset=0){
 for(let i=minOffset;i<minOffset+14;i++){const d=shiftDate(cnToday(),i);if(weekdayOf(d)===label)return d;}
 throw Error('no weekday '+label);
}
test('catalog and order lifecycle',async()=>{
 assert.equal((await call('/services')).data.length,7);
 assert.equal((await call('/orders','POST',{serviceId:'c1',student:'Test',phone:'bad'})).status,400);
 const created=await call('/orders','POST',{serviceId:'c1',student:'Test',phone:'13800000000',amount:1});assert.equal(created.status,201);assert.equal(created.data.amount,299);
 const id=created.data.id;assert.equal((await call(`/orders/${id}/complete`,'POST')).status,409);
 const paid=await call(`/orders/${id}/pay`,'POST');assert.equal(paid.data.status,'paid');assert.ok(paid.data.code);
 assert.equal((await call(`/orders/${id}/pay`,'POST')).status,409);
 assert.equal((await call(`/orders/${id}/cancel`,'POST')).status,409);
 assert.equal((await call(`/orders/${id}/complete`,'POST')).data.status,'completed');
});
test('concurrent tutor reservations cannot both pay',async()=>{
 const payload={serviceId:'t1',student:'Test',phone:'13800000000',slot:'周六 09:00–10:00'};
 const a=await call('/orders','POST',payload),b=await call('/orders','POST',payload);
 const results=await Promise.all([call(`/orders/${a.data.id}/pay`,'POST'),call(`/orders/${b.data.id}/pay`,'POST')]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
});
test('merchant application and approval',async()=>{
 const a=await call('/applications','POST',{name:'Test institution',contact:'Test contact',phone:'13800000000',type:'机构'});assert.equal(a.status,201);assert.equal(a.data.contact,'Test contact');
 assert.equal((await call(`/applications/${a.data.id}/approve`,'POST')).data.status,'approved');
 assert.equal((await call(`/applications/${a.data.id}/approve`,'POST')).status,409);
});
test('tutor application validates and persists type-specific fields',async()=>{
 const payload={name:'Test tutor',phone:'13800000000',type:'家教',education:'本科',school:'演示大学',grade:'大三',subjects:'英语、科学',resume:'演示教学经历',hourlyRate:'120.50',photo:'data:image/jpeg;base64,/9j/2Q=='};
 assert.equal((await call('/applications','POST',{...payload,hourlyRate:'-1'})).status,400);
 assert.equal((await call('/applications','POST',{...payload,photo:'data:image/svg+xml;base64,AAAA'})).status,400);
 assert.equal((await call('/applications','POST',{...payload,school:''})).status,400);
 assert.equal((await call('/applications','POST',{...payload,resume:'a'.repeat(1001)})).status,400);
 const result=await call('/applications','POST',payload);assert.equal(result.status,201);
 assert.equal(result.data.hourlyRate,120.5);assert.equal(result.data.photo,payload.photo);
 for(const key of ['education','school','grade','subjects','resume'])assert.equal(result.data[key],payload[key]);
 assert.equal((await call('/applications')).data.find(a=>a.id===result.data.id).resume,payload.resume);
});

test('service catalog exposes enriched fields without external dependencies',async()=>{
 const list=(await call('/services')).data;
 const course=list.find(s=>s.id==='c1'),tutor=list.find(s=>s.id==='t1'),bus=list.find(s=>s.id==='b1');
 assert.equal(course.city,'杭州');assert.equal(course.category,'艺术启蒙');
 assert.ok(course.merchantDetail.name);assert.ok(Array.isArray(course.merchantDetail.licenses));
 assert.ok(Array.isArray(course.images)&&course.images.length>=2);
 for(const img of course.images)assert.ok(img.name&&img.kind&&!String(img.src||'').startsWith('http'));
 assert.equal(tutor.tutorDetail.school,'演示师范大学');
 assert.ok(tutor.tutorDetail.subjects.length>=1&&tutor.tutorDetail.methods.length>=1);
 assert.equal(tutor.calendar.mode,'slot');assert.ok(tutor.calendar.slots.includes('周六 09:00–10:00'));
 assert.equal(bus.busDetail.driver,'张师傅（演示）');assert.equal(bus.busDetail.plate,'浙A·DEMO1');
 assert.ok(Array.isArray(bus.busDetail.period));
 assert.equal(bus.busDetail.routes.length,3);
 for(const stop of bus.busDetail.routes){assert.ok(stop.name);assert.match(stop.arrival,/^\d{2}:\d{2}$/);assert.match(stop.departure,/^\d{2}:\d{2}$/);}
});

test('merchant directory derives from courses and merges detail',async()=>{
 const all=(await call('/merchants')).data;
 assert.equal(all.length,7);
 const institution=all.find(m=>m.name==='拾光艺术中心');
 assert.equal(institution.city,'杭州');assert.ok(institution.categories.includes('艺术启蒙'));
 assert.ok(institution.types.includes('course'));assert.equal(institution.serviceCount,1);
 assert.ok(institution.intro&&institution.address&&institution.contact);
 const courses=(await call('/merchants?type=course')).data;
 assert.equal(courses.length,3);assert.ok(courses.every(m=>m.types.every(t=>t==='course')));
 assert.ok((await call('/merchants?q=拾光')).data.some(m=>m.name==='拾光艺术中心'));
 assert.equal((await call('/merchants?q=不存在的机构')).data.length,0);
});

test('content endpoint serves faq about contact',async()=>{
 const c=(await call('/content')).data;
 assert.equal(c.city,'杭州');assert.ok(c.faq.length>=5);assert.ok(c.about.title&&c.about.version);
 assert.ok(c.contact.email.includes('@'));assert.ok(Array.isArray(c.categories));
 for(const item of c.faq)assert.ok(item.id&&item.question&&item.answer);
 assert.equal((await call('/content/faq')).data.length,c.faq.length);
 assert.equal((await call('/content/about')).data.title,c.about.title);
 assert.equal((await call('/content/contact')).data.phone,c.contact.phone);
});

test('profile read and whitelisted update persists',async()=>{
 const initial=(await call('/profile')).data;
 assert.ok(initial.name&&Array.isArray(initial.students));
 assert.equal((await call('/profile','PUT',{name:'家长甲',evil:1})).status,400);
 assert.equal((await call('/profile','PUT',{phone:'123'})).status,400);
 assert.equal((await call('/profile','PUT',{students:[{name:''}]})).status,400);
 assert.equal((await call('/profile','PUT',{students:[{name:'乐乐',age:200}]})).status,400);
 const ok=await call('/profile','PUT',{name:'家长甲',phone:'13900000000',address:'杭州市西湖区 1 号',note:'演示',students:[{name:'乐乐',age:9,gender:'女',guardian:'家长甲',relation:'家长',phone:'13900000000'}]});
 assert.equal(ok.status,200);assert.equal(ok.data.name,'家长甲');assert.equal(ok.data.students[0].age,9);assert.ok(ok.data.updatedAt);
 const reread=(await call('/profile')).data;assert.equal(reread.address,'杭州市西湖区 1 号');assert.equal(reread.students[0].relation,'家长');
 assert.equal((await call('/profile','PUT',{name:initial.name})).status,200);
});

test('feedback validates and lists',async()=>{
 assert.equal((await call('/feedback','POST',{category:'课程',content:'短'})).status,400);
 assert.equal((await call('/feedback','POST',{category:'不存在',content:'这是一条合法的反馈内容'})).status,400);
 assert.equal((await call('/feedback','POST',{category:'课程',content:'这是一条合法的反馈内容',contact:'abc'})).status,400);
 assert.equal((await call('/feedback','POST',{category:'课程',content:'这是一条合法的反馈内容',rating:9})).status,400);
 assert.equal((await call('/feedback','POST',{category:'课程',content:'这是一条合法的反馈内容',channel:'x'})).status,400);
 assert.equal((await call('/feedback','POST',{category:'订单',content:'这是一条合法的反馈内容',orderNumber:'ED0'})).status,404);
 const created=await call('/feedback','POST',{category:'家教',content:'希望增加更多晚上可约的时段',contact:'13900000000',rating:4});
 assert.equal(created.status,201);assert.equal(created.data.status,'pending');assert.equal(created.data.rating,4);
 const list=(await call('/feedback')).data;assert.equal(list[0].id,created.data.id);
 assert.ok((await call('/feedback?status=pending')).data.some(f=>f.id===created.data.id));
 assert.equal((await call('/feedback?status=closed')).data.length,0);
});

test('order accepts optional guardian and bus stop fields with validation',async()=>{
 const denied=await call('/orders','POST',{serviceId:'b1',student:'Test',phone:'13800000000',startPoint:'江南家园',endPoint:'星光小区'});
 assert.equal(denied.status,400);assert.match(denied.data.error,/之后/);
 assert.equal((await call('/orders','POST',{serviceId:'b1',student:'Test',phone:'13800000000',startPoint:'不存在站',endPoint:'示范学校'})).status,400);
 assert.equal((await call('/orders','POST',{serviceId:'b1',student:'Test',phone:'13800000000',startPoint:'星光小区'})).status,400);
 assert.equal((await call('/orders','POST',{serviceId:'b1',student:'Test',phone:'13800000000',startPoint:'星光小区',endPoint:'示范学校',period:'年付'})).status,400);
 const term=await call('/orders','POST',{serviceId:'b1',student:'Test',phone:'13800000000',startPoint:'星光小区',endPoint:'示范学校',period:'学期付'});
 assert.equal(term.status,400);assert.match(term.data.error,/月付/);
 const bus=await call('/orders','POST',{serviceId:'b1',student:'小明',phone:'13800000000',startPoint:'星光小区',endPoint:'示范学校',period:'月付',guardian:'家长甲',relation:'母亲',age:9,gender:'男',address:'杭州市滨江区演示路 1 号'});
 assert.equal(bus.status,201);assert.equal(bus.data.startPoint,'星光小区');assert.equal(bus.data.endPoint,'示范学校');
 assert.equal(bus.data.period,'月付');assert.equal(bus.data.guardian,'家长甲');assert.equal(bus.data.relation,'母亲');assert.equal(bus.data.age,9);
 assert.equal((await call(`/orders/${bus.data.id}/pay`,'POST')).data.status,'paid');
 assert.equal((await call(`/orders/${bus.data.id}/complete`,'POST')).data.status,'completed');
 const course=await call('/orders','POST',{serviceId:'c2',student:'小明',phone:'13800000000',date:'2026-11-07',guardian:'家长甲',relation:'父亲'});
 assert.equal(course.status,201);assert.equal(course.data.date,'2026-11-07');assert.equal(course.data.startPoint,undefined);
 assert.equal((await call(`/orders/${course.data.id}/cancel`,'POST')).data.status,'cancelled');
 assert.equal((await call('/orders','POST',{serviceId:'c2',student:'小明',phone:'13800000000',date:'2026-02-30'})).status,400);
 assert.equal((await call('/orders','POST',{serviceId:'c2',student:'小明',phone:'13800000000',relation:'朋友'})).status,400);
 assert.equal((await call('/orders','POST',{serviceId:'c2',student:'小明',phone:'13800000000',age:0})).status,400);
 assert.equal((await call('/orders','POST',{serviceId:'c2',student:'小明',phone:'13800000000',gender:'未知'})).status,400);
});

test('tutor keeps slot calendar and rejects unknown slots',async()=>{
 assert.equal((await call('/orders','POST',{serviceId:'t2',student:'Test',phone:'13800000000',slot:'周一 08:00–09:00'})).status,400);
 assert.equal((await call('/orders','POST',{serviceId:'t2',student:'Test',phone:'13800000000'})).status,400);
 const ok=await call('/orders','POST',{serviceId:'t2',student:'Test',phone:'13800000000',slot:'周日 14:00–15:00'});
 assert.equal(ok.status,201);assert.equal(ok.data.slot,'周日 14:00–15:00');
 assert.equal((await call(`/orders/${ok.data.id}/pay`,'POST')).data.status,'paid');
});

test('custom services can be created and updated with strict whitelist',async()=>{
 assert.equal((await call('/services','POST',{type:'course',title:'T',merchant:'M',category:'艺术启蒙',price:1,extra:1})).status,400);
 assert.equal((await call('/services','POST',{type:'unknown',title:'T',merchant:'M',category:'艺术启蒙',price:1})).status,400);
 assert.equal((await call('/services','POST',{type:'course',merchant:'M',category:'艺术启蒙',price:1})).status,400);
 assert.equal((await call('/services','POST',{type:'course',title:'T',merchant:'M',category:'艺术启蒙',price:-5})).status,400);
 assert.equal((await call('/services','POST',{type:'course',title:'T',merchant:'M',category:'艺术启蒙',price:1,tone:'neon'})).status,400);
 const created=await call('/services','POST',{type:'course',title:'AI 创客工作坊',merchant:'未来星科创',category:'科学探索',price:268,unit:'4课时',remaining:5,description:'演示新增课程',images:[{name:'主视觉',kind:'banner',tone:'mint'}]});
 assert.equal(created.status,201);assert.ok(created.data.id);assert.equal(created.data.builtin,false);
 const id=created.data.id;
 assert.ok((await call('/services')).data.some(s=>s.id===id));
 assert.ok((await call('/merchants')).data.find(m=>m.name==='未来星科创').serviceCount>=2);
 const updated=await call(`/services/${id}`,'PUT',{price:288,remaining:7,icon:'🤖'});
 assert.equal(updated.status,200);assert.equal(updated.data.price,288);assert.equal(updated.data.remaining,7);assert.equal(updated.data.title,'AI 创客工作坊');
 assert.equal((await call(`/services/${id}`,'PUT',{type:'bus'})).status,200);
 assert.equal((await call('/services')).data.find(s=>s.id===id).type,'course');
 assert.equal((await call(`/services/${id}`,'PUT',{id:'hacked'})).status,400);
 assert.equal((await call('/services/c1','PUT',{title:'改名后的美术课'})).status,200);
 assert.equal((await call('/services')).data.find(s=>s.id==='c1').title,'改名后的美术课');
 assert.equal((await call('/services')).data.filter(s=>s.id==='c1').length,1);
 assert.equal((await call('/services/nope','PUT',{title:'x'})).status,404);
 const order=await call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000'});
 assert.equal(order.status,201);assert.equal(order.data.amount,288);
});

test('bus detail update validates route order and keeps old orders valid',async()=>{
 const bad=await call('/services/b2','PUT',{busDetail:{routes:[{name:'文苑小区',arrival:'07:00',departure:'07:02'},{name:'翠苑社区',arrival:'06:50',departure:'07:17'}]}});
 assert.equal(bad.status,400);
 assert.equal((await call('/services/b2','PUT',{busDetail:{routes:[{name:'A',arrival:'07:00',departure:'07:02'}]}})).status,400);
 assert.equal((await call('/services/b2','PUT',{busDetail:{routes:[{name:'A',arrival:'25:00',departure:'07:02'},{name:'B',arrival:'08:00',departure:'08:05'}]}})).status,400);
 assert.equal((await call('/services/b2','PUT',{busDetail:{routes:[{name:'A',arrival:'07:00',departure:'07:10'},{name:'B',arrival:'07:05',departure:'07:20'}]}})).status,400);
 const termPay=await call('/services/b2','PUT',{busDetail:{period:['月付','学期付'],routes:[{name:'文苑小区',arrival:'07:00',departure:'07:02'},{name:'翠苑社区',arrival:'07:15',departure:'07:17'},{name:'示范学校',arrival:'07:32',departure:'16:40'}]}});
 assert.equal(termPay.status,400);assert.match(termPay.data.error,/月付/);
 assert.equal((await call('/services/b2','PUT',{busDetail:{period:['季付']}})).status,400);
 const before=await call('/orders','POST',{serviceId:'b2',student:'Test',phone:'13800000000',startPoint:'文苑小区',endPoint:'示范学校'});
 assert.equal(before.status,201);
 const ok=await call('/services/b2','PUT',{busDetail:{driver:'王师傅（演示）',plate:'浙A·DEMO3',period:['月付'],routes:[{name:'文苑小区',arrival:'07:00',departure:'07:02'},{name:'翠苑社区',arrival:'07:15',departure:'07:17'},{name:'示范学校',arrival:'07:32',departure:'16:40'}]}});
 assert.equal(ok.status,200);assert.equal(ok.data.busDetail.plate,'浙A·DEMO3');
 assert.deepEqual(ok.data.busDetail.period,['月付']);
 assert.equal((await call(`/orders/${before.data.id}/pay`,'POST')).status,200);
});

test('legacy store without new collections still boots',async()=>{
 const legacyDir=await mkdtemp(path.join(tmpdir(),'education-legacy-'));
 try{
  await writeFileSync(path.join(legacyDir,'store.json'),JSON.stringify({orders:[{id:'old-1',number:'ED1',serviceId:'c1',title:'旧订单',type:'course',student:'旧学员',phone:'13800000000',slot:'',amount:299,status:'pending',createdAt:'2026-01-01T00:00:00.000Z'}]}));
  const legacy=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{env:{...process.env,PORT:'3198',DATA_DIR:legacyDir},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{legacy.stdout.once('data',resolve);legacy.once('error',reject);legacy.once('exit',code=>reject(Error('Server exited '+code)));});
  const get=async q=>{const r=await fetch('http://127.0.0.1:3198/api'+q);return {status:r.status,data:await r.json()};};
  const orders=await get('/orders');assert.equal(orders.data.length,1);assert.equal(orders.data[0].student,'旧学员');
  assert.equal((await get('/profile')).status,200);
  assert.deepEqual((await get('/feedback')).data,[]);
  assert.ok((await get('/content')).data.faq.length>0);
  assert.equal((await get('/services')).data.length,7);
  const pay=await fetch('http://127.0.0.1:3198/api/orders/old-1/pay',{method:'POST'});assert.equal(pay.status,200);
  const exited=new Promise(resolve=>legacy.once('exit',resolve));legacy.kill();await exited;
 }finally{await rm(legacyDir,{recursive:true,force:true});}
});

test('unknown api path still 404 and amounts are server controlled',async()=>{
 assert.equal((await call('/nothing')).status,404);
 const created=await call('/orders','POST',{serviceId:'c3',student:'Test',phone:'13800000000',amount:1,status:'paid'});
 assert.equal(created.data.amount,399);assert.equal(created.data.status,'pending');
});

test('tutor calendar can be replaced through service PUT with strict validation',async()=>{
 const created=await call('/services','POST',{type:'tutor',title:'周老师 · 数学思维',merchant:'周老师',category:'科学探索',price:130,unit:'小时'});
 assert.equal(created.status,201);assert.equal(created.data.calendar.mode,'slot');
 assert.ok(created.data.calendar.slots.includes('周六 09:00–10:00'));
 const id=created.data.id;
 const slots=['周三 18:00–19:00','周四 18:00–19:00'];
 const ok=await call(`/services/${id}`,'PUT',{calendar:{slots,slotDurationMinutes:60,mode:'slot'}});
 assert.equal(ok.status,200);
 assert.deepEqual(ok.data.calendar.slots,slots);assert.equal(ok.data.calendar.slotDurationMinutes,60);assert.equal(ok.data.calendar.mode,'slot');
 assert.ok(ok.data.calendar.note);
 assert.deepEqual((await call('/services')).data.find(s=>s.id===id).calendar.slots,slots);
 const bad=[
  {slots:[],slotDurationMinutes:60,mode:'slot'},
  {slots:[' 周三 18:00–19:00'],slotDurationMinutes:60,mode:'slot'},
  {slots:['周三 18:00–19:00','周三 18:00–19:00'],slotDurationMinutes:60,mode:'slot'},
  {slots:['x'.repeat(61)],slotDurationMinutes:60,mode:'slot'},
  {slots:['周三 18:00–19:00'],slotDurationMinutes:45,mode:'slot'},
  {slots:['周三 18:00–19:00'],slotDurationMinutes:60,mode:'date'},
  {slots:['周三 18:00–19:00',5],slotDurationMinutes:60,mode:'slot'},
  {slots:Array.from({length:31},(_,i)=>`时段${i}`),slotDurationMinutes:60,mode:'slot'},
  {slots:['周三 18:00–19:00'],slotDurationMinutes:60,mode:'slot',date:'2026-11-01'},
  'not-an-object',
  {slotDurationMinutes:60,mode:'slot'}
 ];
 for(const calendar of bad){const r=await call(`/services/${id}`,'PUT',{calendar});assert.equal(r.status,400,JSON.stringify(calendar));}
 assert.deepEqual((await call('/services')).data.find(s=>s.id===id).calendar.slots,slots);
 const max=await call(`/services/${id}`,'PUT',{calendar:{slots:Array.from({length:30},(_,i)=>`时段${i}`),slotDurationMinutes:60,mode:'slot'}});
 assert.equal(max.status,200);assert.equal(max.data.calendar.slots.length,30);
 assert.deepEqual((await call(`/services/${id}`,'PUT',{calendar:{slots,slotDurationMinutes:60,mode:'slot'}})).data.calendar.slots,slots);
 // 非家教服务不接受排期
 assert.equal((await call('/services/c1','PUT',{calendar:{slots:['周一 10:00–11:00'],mode:'slot',slotDurationMinutes:60}})).status,400);
 // 时段排期不承诺真实日期
 const probe=await call(`/services/${id}`,'PUT',{calendar:{slots:['周五 20:00–21:00'],slotDurationMinutes:60,mode:'slot'}});
 assert.equal(probe.data.calendar.note.includes('不支持指定日期'),true);
 assert.equal(probe.data.calendar.hasOwnProperty('date'),false);
});

test('tutor calendar merge keeps nested detail and old fields',async()=>{
 const created=await call('/services','POST',{type:'tutor',title:'吴老师 · 作文提升',merchant:'吴老师',category:'语言表达',price:140,unit:'小时',
   tutorDetail:{name:'吴老师',school:'演示学院',education:'本科 · 汉语言',subjects:['作文'],methods:['提纲训练']},
   merchantDetail:{name:'吴老师',intro:'演示机构介绍',foundYear:2020,verified:true,licenses:['办学许可 · 演示']}});
 assert.equal(created.status,201);
 const id=created.data.id;
 const merged=await call(`/services/${id}`,'PUT',{calendar:{slots:['周六 15:00–16:00'],slotDurationMinutes:60,mode:'slot'}});
 assert.equal(merged.status,200);
 assert.equal(merged.data.tutorDetail.school,'演示学院');
 assert.deepEqual(merged.data.tutorDetail.subjects,['作文']);
 assert.equal(merged.data.merchantDetail.intro,'演示机构介绍');
 assert.equal(merged.data.merchantDetail.foundYear,2020);
 assert.deepEqual(merged.data.merchantDetail.licenses,['办学许可 · 演示']);
 const partial=await call(`/services/${id}`,'PUT',{tutorDetail:{certificate:'普通话一级 · 演示'}});
 assert.equal(partial.status,200);
 assert.equal(partial.data.tutorDetail.certificate,'普通话一级 · 演示');
 assert.equal(partial.data.tutorDetail.school,'演示学院');
 assert.deepEqual(partial.data.tutorDetail.methods,['提纲训练']);
 assert.deepEqual(partial.data.calendar.slots,['周六 15:00–16:00']);
 const reread=(await call('/services')).data.find(s=>s.id===id);
 assert.equal(reread.merchantDetail.intro,'演示机构介绍');
 assert.deepEqual(reread.calendar.slots,['周六 15:00–16:00']);
});

test('orders created before a schedule change still follow their own slot snapshot',async()=>{
 const created=await call('/services','POST',{type:'tutor',title:'郑老师 · 物理入门',merchant:'郑老师',category:'科学探索',price:160,unit:'小时'});
 const id=created.data.id;assert.equal(created.status,201);
 const pending=await call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000',slot:'周六 09:00–10:00'});
 assert.equal(pending.status,201);assert.deepEqual(pending.data.slotsSnapshot,['周六 09:00–10:00','周六 10:00–11:00','周日 14:00–15:00']);
 const rescheduled=await call(`/services/${id}`,'PUT',{calendar:{slots:['周一 08:00–09:00'],slotDurationMinutes:60,mode:'slot'}});
 assert.equal(rescheduled.status,200);
 assert.deepEqual(rescheduled.data.calendar.slots,['周一 08:00–09:00']);
 // 已创建订单仍按创建时的时段规则支付
 assert.equal((await call(`/orders/${pending.data.id}/pay`,'POST')).status,200);
 // 新下单必须落在新排期内
 assert.equal((await call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000',slot:'周六 09:00–10:00'})).status,400);
 const newSlot=await call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000',slot:'周一 08:00–09:00'});
 assert.equal(newSlot.status,201);
 // 与已支付订单同一时段的第二次预约仍冲突
 const dup=await call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000',slot:'周一 08:00–09:00'});
 assert.equal(dup.status,201);assert.equal((await call(`/orders/${newSlot.data.id}/pay`,'POST')).status,200);
 assert.equal((await call(`/orders/${dup.data.id}/pay`,'POST')).status,409);
});

test('legacy orders without snapshots still pay after the schedule is rewritten',async()=>{
 const legacyDir=await mkdtemp(path.join(tmpdir(),'education-legacy-slot-'));
 try{
  await writeFileSync(path.join(legacyDir,'store.json'),JSON.stringify({
   services:[{id:'t-legacy',type:'tutor',title:'旧家教',merchant:'旧老师',category:'语言表达',price:100,unit:'小时',remaining:1,
     tutorDetail:{name:'旧老师',school:'旧学院'}}],
   orders:[{id:'o-old',number:'ED2',serviceId:'t-legacy',title:'旧家教',type:'tutor',student:'旧学员',phone:'13800000000',slot:'周六 09:00–10:00',amount:100,status:'pending',createdAt:'2026-01-01T00:00:00.000Z'}]
  }));
  const proc=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{env:{...process.env,PORT:'3197',DATA_DIR:legacyDir},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{proc.stdout.once('data',resolve);proc.once('error',reject);proc.once('exit',code=>reject(Error('Server exited '+code)));});
  const api=async(q,method='GET',data)=>{const r=await fetch('http://127.0.0.1:3197/api'+q,{method,headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,data:await r.json()};};
  try{
   const list=(await api('/services')).data;assert.equal(list.length,8);
   const service=list.find(s=>s.id==='t-legacy');
   assert.equal(service.calendar.mode,'slot');
   // 种子演示时段未改动前，旧排期可以正常下单并带上快照
   const before=await api('/orders','POST',{serviceId:'t-legacy',student:'新学员',phone:'13800000000',slot:'周六 10:00–11:00'});
   assert.equal(before.status,201);assert.deepEqual(before.data.slotsSnapshot,['周六 09:00–10:00','周六 10:00–11:00','周日 14:00–15:00']);
   const rewritten=await api('/services/t-legacy','PUT',{calendar:{slots:['周一 08:00–09:00'],slotDurationMinutes:60,mode:'slot'}});
   assert.equal(rewritten.status,200);
   assert.equal(rewritten.data.tutorDetail.school,'旧学院');
   // 改排期后新时段可约，旧时段被拒
   assert.equal((await api('/orders','POST',{serviceId:'t-legacy',student:'新学员',phone:'13800000000',slot:'周六 09:00–10:00'})).status,400);
   // 未带快照的历史订单不受排期变更影响，照常支付
   const retry=await api('/orders/o-old/pay','POST');
   assert.equal(retry.status,200);assert.equal(retry.data.status,'paid');
   assert.equal((await api('/orders/o-old/cancel','POST')).status,409);
  }finally{const exited=new Promise(resolve=>proc.once('exit',resolve));proc.kill();await exited;}
 }finally{await rm(legacyDir,{recursive:true,force:true});}
});

/* ------------------------------------------------------------------ */
/* 家教实际日期多时段预约                                              */
/* ------------------------------------------------------------------ */
const SAT='周六 09:00–10:00', SAT2='周六 10:00–11:00', SUN='周日 14:00–15:00';
async function newTutor(title,extra={}){
 const r=await call('/services','POST',{type:'tutor',title,merchant:'测试老师',category:'科学探索',price:130,unit:'小时',...extra});
 assert.equal(r.status,201);return r.data.id;
}
test('tutor multi-session order computes amount hours and unit price',async()=>{
 const id=await newTutor('多时段 · 金额用例');
 await call(`/services/${id}`,'PUT',{calendar:{slots:[SAT,SAT2,SUN],slotDurationMinutes:60,mode:'slot'}});
 await call(`/services/${id}`,'PUT',{price:133.33});
 const sat=nextWeekday('周六'),sun=nextWeekday('周日');
 const created=await call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000',
  sessions:[{date:sat,slot:SAT},{date:sun,slot:SUN}]});
 assert.equal(created.status,201,JSON.stringify(created.data));
 assert.equal(created.data.amount,267);            // 133.33 * 2 = 266.66 -> 四舍五入 267
 assert.equal(created.data.unitPrice,133.33);
 assert.equal(created.data.hours,2);
 assert.equal(created.data.slot,'');
 assert.equal(created.data.sessions.length,2);
 assert.equal(created.data.sessions[0].date,sat);  // 按日期、时段时间排序
 assert.equal(created.data.dateStatus,'scheduled');
 assert.ok(Array.isArray(created.data.slotsSnapshot));
 // 服务端计价，客户端传入的金额无效
 const single=await call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000',amount:1,
  sessions:[{date:sun,slot:SUN}]});
 assert.equal(single.data.amount,133);assert.equal(single.data.hours,1);
 assert.equal((await call(`/orders/${single.data.id}/cancel`,'POST')).status,200);
 // 三段：399.99 -> 400，时段按日期+排期顺序归一
 const three=await call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000',
  sessions:[{date:sun,slot:SUN},{date:sat,slot:SAT2},{date:sat,slot:SAT}]});
 assert.equal(three.status,201);
 assert.equal(three.data.amount,400);assert.equal(three.data.hours,3);
 assert.deepEqual(three.data.sessions,[{date:sat,slot:SAT},{date:sat,slot:SAT2},{date:sun,slot:SUN}]);
 assert.equal((await call(`/orders/${three.data.id}/cancel`,'POST')).status,200);
});

test('tutor sessions validation rejects bad dates slots weekdays and duplicates',async()=>{
 const id=await newTutor('多时段 · 校验用例');
 await call(`/services/${id}`,'PUT',{calendar:{slots:[SAT,SAT2,SUN],slotDurationMinutes:60,mode:'slot'}});
 const sat=nextWeekday('周六'),sun=nextWeekday('周日');
 const post=sessions=>call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000',sessions});
 const cases=[
  [[{date:sat,slot:'周一 08:00–09:00'}]],                    // 时段不在 calendar
  [[{date:sat,slot:'周六 09:00–10:00 '}]],                   // 带尾随空格，不得被静默接受
  [[{date:'2026-02-30',slot:SAT}]],                          // 不存在的日期
  [[{date:shiftDate(cnToday(),-1),slot:SAT}]],               // 过去的日期
  [[{date:'2026/11/07',slot:SAT}]],                          // 日期格式
  [[]],                                                      // 空数组
  [Array.from({length:21},(_,i)=>({date:shiftDate(sat,i*7),slot:SAT}))], // 超过 20
  [[{date:sun,slot:SAT}]],                                    // 星期不一致（周日日期配周六时段）
  [[{date:sat,slot:SAT},{date:sat,slot:SAT}]],                // 重复 date+slot
  [[{date:sat,slot:SAT,fee:1}]],                              // 非白名单字段
  [[{slot:SAT}]],                                             // 缺日期
  [[{date:sat}]],                                             // 缺时段
  ['2026-11-07']
 ];
 for(const [sessions] of cases){
  const r=await post(sessions);
  assert.equal(r.status,400,JSON.stringify(sessions).slice(0,120)+' -> '+JSON.stringify(r.data));
 }
 // 与 slot 同时提交属于口径冲突
 const both=await call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000',slot:SAT,sessions:[{date:sat,slot:SAT}]});
 assert.equal(both.status,400);
 // 非家教服务不接受 sessions
 assert.equal((await call('/orders','POST',{serviceId:'c1',student:'Test',phone:'13800000000',sessions:[{date:sat,slot:SAT}]})).status,400);
 // 20 个时段是上限，可以通过
 const many=await post(Array.from({length:20},(_,i)=>({date:shiftDate(sat,i*7),slot:SAT})));
 assert.equal(many.status,201);assert.equal(many.data.hours,20);assert.equal(many.data.amount,2600);
 assert.equal((await call(`/orders/${many.data.id}/cancel`,'POST')).status,200);
});

test('availability only lists slots matching the weekday and excludes paid ones',async()=>{
 const id=await newTutor('多时段 · 可约查询');
 await call(`/services/${id}`,'PUT',{calendar:{slots:[SAT,SAT2,SUN],slotDurationMinutes:60,mode:'slot'}});
 const sat=nextWeekday('周六'),sun=nextWeekday('周日'),mon=nextWeekday('周一');
 const satList=await call(`/services/${id}/availability?date=${sat}`);
 assert.equal(satList.status,200);assert.equal(satList.data.date,sat);
 assert.deepEqual(satList.data.slots,[{slot:SAT,available:true},{slot:SAT2,available:true}]);
 const monList=await call(`/services/${id}/availability?date=${mon}`);
 assert.equal(monList.status,200);assert.deepEqual(monList.data.slots,[]);
 assert.equal((await call(`/services/${id}/availability`)).status,400);
 assert.equal((await call(`/services/${id}/availability?date=2026-02-30`)).status,400);
 assert.equal((await call('/services/c1/availability?date='+sat)).status,400);
 assert.equal((await call('/services/nope/availability?date='+sat)).status,404);
 const order=await call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000',sessions:[{date:sat,slot:SAT}]});
 assert.equal(order.status,201);
 // 待支付不占用
 assert.deepEqual((await call(`/services/${id}/availability?date=${sat}`)).data.slots.find(x=>x.slot===SAT),{slot:SAT,available:true});
 assert.equal((await call(`/orders/${order.data.id}/pay`,'POST')).status,200);
 assert.deepEqual((await call(`/services/${id}/availability?date=${sat}`)).data.slots.find(x=>x.slot===SAT),{slot:SAT,available:false});
 assert.deepEqual((await call(`/services/${id}/availability?date=${sat}`)).data.slots.find(x=>x.slot===SAT2),{slot:SAT2,available:true});
 // 其他日期同一时段不受影响
 assert.deepEqual((await call(`/services/${id}/availability?date=${shiftDate(sat,7)}`)).data.slots.find(x=>x.slot===SAT),{slot:SAT,available:true});
 // 核销后仍然占用
 assert.equal((await call(`/orders/${order.data.id}/complete`,'POST')).status,200);
 assert.equal((await call(`/services/${id}/availability?date=${sat}`)).data.slots.find(x=>x.slot===SAT).available,false);
 assert.equal((await call(`/services/${id}/availability?date=${sun}`)).data.slots.length,1);
});

test('multi-session payment is all-or-nothing under concurrency',async()=>{
 const id=await newTutor('多时段 · 并发用例');
 await call(`/services/${id}`,'PUT',{calendar:{slots:[SAT,SAT2,SUN],slotDurationMinutes:60,mode:'slot'}});
 const sat=nextWeekday('周六'),sun=nextWeekday('周日');
 const post=(student,sessions)=>call('/orders','POST',{serviceId:id,student,phone:'13800000000',sessions});
 const mk=student=>post(student,[{date:sat,slot:SAT},{date:sun,slot:SUN}]);
 const orders=[];
 for(const student of ['A','B','C','D','E'])orders.push(await mk(student));
 assert.ok(orders.every(o=>o.status===201));
 // 5 单都占用同样两个时段：并发支付（含重复支付）只允许 1 单成交，且成交后两个时段都被占用
 const results=await Promise.all(orders.flatMap(o=>[call(`/orders/${o.data.id}/pay`,'POST'),call(`/orders/${o.data.id}/pay`,'POST')]));
 assert.ok(results.every(r=>[200,409].includes(r.status)));
 const statuses=[];
 for(const o of orders)statuses.push((await call('/orders')).data.find(x=>x.id===o.data.id).status);
 assert.equal(statuses.filter(s=>s==='paid').length,1,JSON.stringify(statuses));
 // 成功者的两个时段都变红
 const paidOrder=orders[statuses.indexOf('paid')].data;
 for(const session of paidOrder.sessions){
  assert.equal((await call(`/services/${id}/availability?date=${session.date}`)).data.slots.find(s=>s.slot===session.slot).available,false);
 }
});

test('partial conflicts reject the whole multi-session orders',async()=>{
 const id=await newTutor('多时段 · 整单拒绝');
 await call(`/services/${id}`,'PUT',{calendar:{slots:[SAT,SAT2,SUN],slotDurationMinutes:60,mode:'slot'}});
 const sat=nextWeekday('周六'),sun=nextWeekday('周日');
 const first=await call('/orders','POST',{serviceId:id,student:'A',phone:'13800000000',sessions:[{date:sat,slot:SAT},{date:sun,slot:SUN}]});
 assert.equal((await call(`/orders/${first.data.id}/pay`,'POST')).status,200);
 const clash=await call('/orders','POST',{serviceId:id,student:'B',phone:'13800000000',sessions:[{date:sat,slot:SAT2},{date:sun,slot:SUN}]});
 assert.equal(clash.status,201);
 const pay=await call(`/orders/${clash.data.id}/pay`,'POST');
 assert.equal(pay.status,409);
 assert.ok(clash.data.sessions.every(s=>s.date));
 // 被拒后订单仍是待支付，可以取消；未冲突的时段依然可售
 const all=(await call('/orders')).data;assert.equal(all.find(o=>o.id===clash.data.id).status,'pending');
 assert.equal((await call(`/orders/${clash.data.id}/cancel`,'POST')).status,200);
 assert.equal((await call(`/services/${id}/availability?date=${sat}`)).data.slots.find(s=>s.slot===SAT2).available,true);
});

test('legacy single-slot order only conflicts with a date-less slot request',async()=>{
 const id=await newTutor('多时段 · 旧单兼容');
 await call(`/services/${id}`,'PUT',{calendar:{slots:[SAT,SAT2,SUN],slotDurationMinutes:60,mode:'slot'}});
 const legacy=await call('/orders','POST',{serviceId:id,student:'旧学员',phone:'13800000000',slot:SAT});
 assert.equal(legacy.status,201);assert.equal(legacy.data.slot,SAT);
 assert.equal((await call(`/orders/${legacy.data.id}/pay`,'POST')).status,200);
 const sat=nextWeekday('周六'),sun=nextWeekday('周日');
 // 旧单不阻塞任何一个真实日期的同一时段
 for(const date of [sat,shiftDate(sat,7),shiftDate(sat,14)]){
  const ok=await call('/orders','POST',{serviceId:id,student:'新学员',phone:'13800000000',sessions:[{date,slot:SAT}]});
  assert.equal(ok.status,201,JSON.stringify(ok.data));
  assert.equal((await call(`/orders/${ok.data.id}/pay`,'POST')).status,200);
 }
 // 不带日期的旧口径请求仍然受旧单约束
 const bare=await call('/orders','POST',{serviceId:id,student:'旧学员',phone:'13800000000',slot:SAT});
 assert.equal(bare.status,201);assert.equal((await call(`/orders/${bare.data.id}/pay`,'POST')).status,409);
 // 另一时段的旧口径单互不影响
 const bareOk=await call('/orders','POST',{serviceId:id,student:'旧学员',phone:'13800000000',slot:SUN});
 assert.equal(bareOk.status,201);assert.equal((await call(`/orders/${bareOk.data.id}/pay`,'POST')).status,200);
});

test('single-day legacy request with date conflicts on that exact date',async()=>{
 const id=await newTutor('多时段 · 带日期旧请求');
 await call(`/services/${id}`,'PUT',{calendar:{slots:[SAT,SAT2,SUN],slotDurationMinutes:60,mode:'slot'}});
 const sat=nextWeekday('周六');
 const withDate=await call('/orders','POST',{serviceId:id,student:'A',phone:'13800000000',slot:SAT,date:sat});
 assert.equal(withDate.status,201);assert.equal(withDate.data.date,sat);assert.equal(withDate.data.slot,SAT);
 assert.equal((await call(`/orders/${withDate.data.id}/pay`,'POST')).status,200);
 const clash=await call('/orders','POST',{serviceId:id,student:'B',phone:'13800000000',sessions:[{date:sat,slot:SAT}]});
 assert.equal(clash.status,201);assert.equal((await call(`/orders/${clash.data.id}/pay`,'POST')).status,409);
 // 其他日期的同一时段不受影响
 const other=await call('/orders','POST',{serviceId:id,student:'C',phone:'13800000000',sessions:[{date:shiftDate(sat,7),slot:SAT}]});
 assert.equal(other.status,201);assert.equal((await call(`/orders/${other.data.id}/pay`,'POST')).status,200);
 // 旧请求带日期时星期必须匹配
 assert.equal((await call('/orders','POST',{serviceId:id,student:'D',phone:'13800000000',slot:SAT,date:nextWeekday('周日')})).status,400);
});

test('multi-session orders keep their snapshot after the schedule is rewritten',async()=>{
 const id=await newTutor('多时段 · 快照');
 await call(`/services/${id}`,'PUT',{calendar:{slots:[SAT,SAT2,SUN],slotDurationMinutes:60,mode:'slot'}});
 const sat=nextWeekday('周六'),sun=nextWeekday('周日');
 const pending=await call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000',
  sessions:[{date:sat,slot:SAT},{date:sun,slot:SUN}]});
 assert.equal(pending.status,201);
 assert.deepEqual(pending.data.slotsSnapshot,[SAT,SAT2,SUN]);
 const rewritten=await call(`/services/${id}`,'PUT',{calendar:{slots:['周一 08:00–09:00'],slotDurationMinutes:60,mode:'slot'}});
 assert.equal(rewritten.status,200);
 // 改排期后旧单仍按自身快照支付，快照里的日期与金额不变
 const paid=await call(`/orders/${pending.data.id}/pay`,'POST');
 assert.equal(paid.status,200);assert.equal(paid.data.amount,260);assert.equal(paid.data.hours,2);
 assert.equal(paid.data.sessions[0].date,sat);
 // 已支付的历史时段仍然占用
 const mon=nextWeekday('周一');
 assert.deepEqual((await call(`/services/${id}/availability?date=${mon}`)).data.slots,[{slot:'周一 08:00–09:00',available:true}]);
 assert.deepEqual((await call(`/services/${id}/availability?date=${sat}`)).data.slots,[]);
 // 新单只能落在新排期，且不能与快照外时段混用
 assert.equal((await call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000',sessions:[{date:sat,slot:SAT}]})).status,400);
 const fresh=await call('/orders','POST',{serviceId:id,student:'Test',phone:'13800000000',sessions:[{date:mon,slot:'周一 08:00–09:00'},{date:shiftDate(mon,7),slot:'周一 08:00–09:00'}]});
 assert.equal(fresh.status,201);assert.equal((await call(`/orders/${fresh.data.id}/pay`,'POST')).status,200);
});

test('legacy store with an old paid slot order and new dated orders coexist',async()=>{
 const legacyDir=await mkdtemp(path.join(tmpdir(),'education-legacy-multi-'));
 try{
  const sat=nextWeekday('周六');
  await writeFileSync(path.join(legacyDir,'store.json'),JSON.stringify({
   services:[{id:'t-legacy',type:'tutor',title:'旧家教',merchant:'旧老师',category:'语言表达',price:100,unit:'小时',remaining:1,
    calendar:{mode:'slot',slotDurationMinutes:60,slots:[SAT,SAT2,SUN]},
    tutorDetail:{name:'旧老师',school:'旧学院'}}],
   orders:[{id:'o-paid',number:'ED3',serviceId:'t-legacy',title:'旧家教',type:'tutor',student:'旧学员',phone:'13800000000',slot:SAT,amount:100,status:'paid',createdAt:'2026-01-01T00:00:00.000Z',code:'OLDCODE1'}]
  }));
  const proc=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{env:{...process.env,PORT:'3196',DATA_DIR:legacyDir},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{proc.stdout.once('data',resolve);proc.once('error',reject);proc.once('exit',code=>reject(Error('Server exited '+code)));});
  const api=async(q,method='GET',data)=>{const r=await fetch('http://127.0.0.1:3196/api'+q,{method,headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,data:await r.json()};};
  try{
   // 旧单没有日期，因此不占用任何真实日期的同一时段
   const avail=await api(`/services/t-legacy/availability?date=${sat}`);
   assert.equal(avail.status,200);
   assert.deepEqual(avail.data.slots,[{slot:SAT,available:true},{slot:SAT2,available:true}]);
   const created=await api('/orders','POST',{serviceId:'t-legacy',student:'新学员',phone:'13800000000',sessions:[{date:sat,slot:SAT}]});
   assert.equal(created.status,201,JSON.stringify(created.data));
   assert.equal(created.data.amount,100);assert.equal(created.data.hours,1);
   assert.equal((await api(`/orders/${created.data.id}/pay`,'POST')).status,200);
   assert.deepEqual((await api(`/services/t-legacy/availability?date=${sat}`)).data.slots.find(x=>x.slot===SAT),{slot:SAT,available:false});
   // 旧口径请求仍与旧单冲突
   const bare=await api('/orders','POST',{serviceId:'t-legacy',student:'旧学员',phone:'13800000000',slot:SAT});
   assert.equal(bare.status,201);assert.equal((await api(`/orders/${bare.data.id}/pay`,'POST')).status,409);
  }finally{const exited=new Promise(resolve=>proc.once('exit',resolve));proc.kill();await exited;}
 }finally{await rm(legacyDir,{recursive:true,force:true});}
});
