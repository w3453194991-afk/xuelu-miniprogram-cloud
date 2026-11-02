import assert from 'node:assert/strict';
import {createManager} from '../public/manage.js';
const m=createManager({state:{services:[],orders:[]},esc:String,modal:{}});
const tutor={type:'tutor',teacherName:'演示老师',school:'学校',education:'本科',subjects:'英语、数学',methods:'上门',grades:'小学',experience:'经验',slots:'周六 09:00–10:00\n周日 14:00–15:00'};
m.serialize(tutor,{});assert.equal(tutor.calendar.slots.length,2);assert.deepEqual(tutor.tutorDetail.subjects,['英语','数学']);assert.equal(tutor.unit,'小时');assert.equal(tutor.slots,undefined);
const course={type:'course',merchant:'机构',institutionAddress:'地址',institutionContact:'联系人',institutionPhone:'13800000000',institutionIntro:'简介',teachers:'老师一\n老师二'};m.serialize(course,{});assert.equal(course.merchantDetail.teachers.length,2);assert.equal(course.institutionPhone,undefined);
const bus={type:'bus',driver:'演示司机',driverPhone:'13800000000',plate:'演示车牌',vehicle:'校车',stopName:'ignored',stopArrival:'ignored',stopDeparture:'ignored'};
const stops=[{name:'小区',arrival:'07:00',departure:'07:02'},{name:'学校',arrival:'07:30',departure:'07:32'}];
m.serialize(bus,{querySelectorAll:()=>stops.map(s=>({querySelector:q=>({value:q.includes('stopName')?s.name:q.includes('stopArrival')?s.arrival:s.departure})}))});
assert.equal(bus.busDetail.routes.length,2);assert.deepEqual(bus.busDetail.period,['月付']);assert.equal(bus.stopName,undefined);assert.equal(bus.unit,'月');
console.log('Management serialization: 3 checks passed');
const modal={innerHTML:'',showModal(){}};
const ui=createManager({state:{services:[],orders:[]},esc:s=>String(s??''),modal});
for(const [type,field] of [['course','institutionAddress'],['tutor','slots'],['bus','route-editor']]){ui.open(null,type);assert.ok(modal.innerHTML.includes(field));assert.ok(modal.innerHTML.includes('service-form'));}
console.log('Management form markup: 3 checks passed');
