const KEY='class-planner-events-v1';
let events=[];
try { const data=JSON.parse(localStorage.getItem(KEY)||'[]'); events=Array.isArray(data)?data:[]; } catch { events=[]; }
let weekStart=startOfWeek(new Date());
let editingId=null;
const calendar=document.getElementById('calendar');
const form=document.getElementById('event-form');
const dateInput=document.getElementById('date');
function startOfWeek(date){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-(d.getDay()+6)%7);return d;}
function addDays(date,n){const d=new Date(date);d.setDate(d.getDate()+n);return d;}
function iso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function save(){localStorage.setItem(KEY,JSON.stringify(events));}
function daysLeft(ymd){const today=new Date();const a=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());const [y,m,d]=ymd.split('-').map(Number);return Math.round((Date.UTC(y,m-1,d)-a)/86400000);}
function render(){const end=addDays(weekStart,6);document.getElementById('range').textContent=`${iso(weekStart)} ~ ${iso(end)}`;calendar.replaceChildren();const names=['월','화','수','목','금','토','일'];for(let i=0;i<7;i++){const day=addDays(weekStart,i);const date=iso(day);const box=document.createElement('div');box.className='day';const heading=document.createElement('div');heading.className='day-head';heading.textContent=`${names[i]} ${day.getMonth()+1}/${day.getDate()}`;box.append(heading);events.filter(e=>e.date===date).forEach(e=>{const item=document.createElement('div');item.className='event';const subject=document.createElement('strong');subject.textContent=e.subject;const task=document.createElement('span');task.textContent=e.task;const remaining=document.createElement('small');const left=daysLeft(e.date);remaining.textContent=left===0?'D-day':left>0?`D-${left}`:`D+${-left}`;const controls=document.createElement('div');controls.className='controls';const edit=document.createElement('button');edit.textContent='수정';edit.onclick=()=>{editingId=e.id;document.getElementById('subject').value=e.subject;document.getElementById('task').value=e.task;dateInput.value=e.date;document.getElementById('form-title').textContent='수행평가 수정';document.getElementById('cancel').hidden=false;form.scrollIntoView({behavior:'smooth'});};const del=document.createElement('button');del.textContent='삭제';del.onclick=()=>{if(confirm('이 일정을 삭제할까?')){events=events.filter(x=>x.id!==e.id);save();render();}};controls.append(edit,del);item.append(subject,task,remaining,controls);box.append(item);});calendar.append(box);}}
form.addEventListener('submit',e=>{e.preventDefault();const subject=document.getElementById('subject').value.trim();const task=document.getElementById('task').value.trim();const date=dateInput.value;if(!subject||!task||!date)return;if(editingId){const found=events.find(e=>e.id===editingId);if(found)Object.assign(found,{subject,task,date});}else{events.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),subject,task,date});}save();resetForm();weekStart=startOfWeek(new Date(`${date}T12:00:00`));render();});
function resetForm(){form.reset();editingId=null;document.getElementById('form-title').textContent='수행평가 추가';document.getElementById('cancel').hidden=true;}
document.getElementById('cancel').onclick=resetForm;
document.getElementById('prev').onclick=()=>{weekStart=addDays(weekStart,-7);render();};
document.getElementById('next').onclick=()=>{weekStart=addDays(weekStart,7);render();};
document.getElementById('today').onclick=()=>{weekStart=startOfWeek(new Date());render();};
dateInput.value=iso(new Date());render();
