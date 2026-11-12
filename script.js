import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { getDatabase, ref, onValue, push, set, remove, update } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js';

// Firebase 콘솔의 '프로젝트 설정 > 내 앱 > SDK 설정 및 구성'에서 복사해 채워 넣기.
const firebaseConfig = {
  apiKey: "AIzaSyAbEcguZmrwX_GoVIgUCb8FrDOdwJIkOcs",
  authDomain: 'class-planner-f6143.firebaseapp.com',
  databaseURL: 'https://class-planner-f6143-default-rtdb.firebaseio.com',
  projectId: 'class-planner-f6143',
  appId:  "1:403684835739:web:3bbf54579ad0c3aee6e13e"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const eventsRef = ref(db, 'schedules');
let events = [];
let ready = false;
let admin = false;
const ADMIN_UID = 'yVsFVH4vIBZICv6608ktfhOfiq03';
let unsubscribe = null;
const loginPanel = document.getElementById('login-panel');
const adminControls = document.getElementById('admin-controls');
const authMessage = document.getElementById('auth-message');
const status = document.getElementById('sync-status');
function setStatus(message) { status.textContent = message; }

let weekStart=startOfWeek(new Date());
let monthDate=new Date();
let viewMode='week';
let editingId=null;
const classSelect=document.getElementById('class-select');
const eventClass=document.getElementById('event-class');
let selectedClass='1';
try {const saved=localStorage.getItem('class-planner-class');if(/^[1-6]$/.test(saved))selectedClass=saved;} catch {}
classSelect.value=selectedClass;
eventClass.value=selectedClass;
function belongsToClass(event){return String(event.classId)===selectedClass;}
function updateClassMessage(){document.getElementById('class-message').textContent=`${selectedClass}반 일정입니다. 새 일정도 ${selectedClass}반에 등록됩니다.`;}
classSelect.addEventListener('change',()=>{selectedClass=classSelect.value;resetForm();try{localStorage.setItem('class-planner-class',selectedClass);}catch{}updateClassMessage();render();});
updateClassMessage();
const calendar=document.getElementById('calendar');
const form=document.getElementById('event-form');
const dateInput=document.getElementById('date');
function startOfWeek(date){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-(d.getDay()+6)%7);return d;}
function addDays(date,n){const d=new Date(date);d.setDate(d.getDate()+n);return d;}
function iso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}

function daysLeft(ymd){const today=new Date();const a=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());const [y,m,d]=ymd.split('-').map(Number);return Math.round((Date.UTC(y,m-1,d)-a)/86400000);}
function render(){const isMonth=viewMode==='month';const monthFirst=new Date(monthDate.getFullYear(),monthDate.getMonth(),1);const monthLast=new Date(monthDate.getFullYear(),monthDate.getMonth()+1,0);const first=isMonth?startOfWeek(monthFirst):weekStart;const end=isMonth?addDays(startOfWeek(monthLast),6):addDays(weekStart,6);document.getElementById('range').textContent=isMonth?`${monthDate.getFullYear()}년 ${monthDate.getMonth()+1}월`:`${iso(weekStart)} ~ ${iso(end)}`;document.getElementById('today').textContent=isMonth?'이번 달':'이번 주';const plannerToggle=document.getElementById('planner-toggle');plannerToggle.textContent=isMonth?'Monthly Planner':'Weekly Planner';plannerToggle.setAttribute('aria-label',isMonth?'주간 보기로 전환':'월간 보기로 전환');calendar.classList.toggle('month-view',isMonth);calendar.replaceChildren();const names=['월','화','수','목','금','토','일'];const count=isMonth?Math.round((end-first)/86400000)+1:7;for(let i=0;i<count;i++){const day=addDays(first,i);const date=iso(day);const box=document.createElement('div');box.className='day';if(isMonth && day.getMonth()!==monthDate.getMonth())box.classList.add('outside-month');const heading=document.createElement('div');heading.className='day-head';heading.textContent=`${names[i % 7]} ${day.getMonth()+1}/${day.getDate()}`;box.append(heading);events.filter(e=>belongsToClass(e)&&e.date===date).forEach(e=>{const item=document.createElement('div');item.className='event';const subject=document.createElement('strong');subject.textContent=e.subject;const task=document.createElement('span');task.textContent=e.task;const remaining=document.createElement('small');const left=daysLeft(e.date);remaining.textContent=left===0?'D-day':left>0?`D-${left}`:`D+${-left}`;const controls=document.createElement('div');controls.className='controls';const edit=document.createElement('button');edit.textContent='수정';edit.onclick=()=>{editingId=e.id;eventClass.value=/^[1-6]$/.test(String(e.classId))?String(e.classId):'';document.getElementById('subject').value=e.subject;document.getElementById('task').value=e.task;dateInput.value=e.date;document.getElementById('form-title').textContent='수행평가 수정';document.getElementById('cancel').hidden=false;form.scrollIntoView({behavior:'smooth'});};const del=document.createElement('button');del.textContent='삭제';del.onclick=async()=>{if(!confirm('이 일정을 삭제?'))return;try{await remove(ref(db,`schedules/${e.id}`));}catch(err){alert('삭제 권한이 없거나 연결에 실패했다. '+err.message);}};if(admin)controls.append(edit,del);item.append(subject,task,remaining);if(admin)item.append(controls);box.append(item);});calendar.append(box);}}
form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!admin){alert('관리자 로그인 후 저장할 수 있어요.');return;}
  if(!ready){alert('아직 데이터베이스 연결 중.');return;}
  const subject=document.getElementById('subject').value.trim();
  const task=document.getElementById('task').value.trim();
  const date=dateInput.value;
  const classId=eventClass.value;
  if(!/^[1-6]$/.test(classId))return;
  if(!subject||!task||!date)return;
  try {
    if(editingId){await update(ref(db,`schedules/${editingId}`),{subject,task,date,classId});}
    else {await set(push(eventsRef),{subject,task,date,classId});}
    selectedClass=classId;classSelect.value=classId;updateClassMessage();
    try{localStorage.setItem('class-planner-class',classId);}catch{}
    resetForm();const savedDate=new Date(`${date}T12:00:00`);weekStart=startOfWeek(savedDate);monthDate=new Date(savedDate.getFullYear(),savedDate.getMonth(),1);render();
  } catch(err){alert('저장할 수 없다. 관리자 권한 또는 보안 규칙을 확인해라. '+err.message);}
});
function resetForm(){form.reset();eventClass.value=selectedClass;dateInput.value=iso(new Date());editingId=null;document.getElementById('form-title').textContent='수행평가 추가';document.getElementById('cancel').hidden=true;}
document.getElementById('cancel').onclick=resetForm;
document.getElementById('prev').onclick=()=>{if(viewMode==='month')monthDate=new Date(monthDate.getFullYear(),monthDate.getMonth()-1,1);else weekStart=addDays(weekStart,-7);render();};
document.getElementById('next').onclick=()=>{if(viewMode==='month')monthDate=new Date(monthDate.getFullYear(),monthDate.getMonth()+1,1);else weekStart=addDays(weekStart,7);render();};
document.getElementById('today').onclick=()=>{weekStart=startOfWeek(new Date());monthDate=new Date();render();};
document.getElementById('planner-toggle').onclick=()=>{viewMode=viewMode==='week'?'month':'week';render();};
dateInput.value=iso(new Date());render();
onAuthStateChanged(auth, user => {
  admin=!!user && !user.isAnonymous && user.uid===ADMIN_UID;
  loginPanel.hidden=admin;adminControls.hidden=!admin;
  resetForm();render();
  if(unsubscribe){unsubscribe();unsubscribe=null;}
  if(!user){ready=false;setStatus('로그인 연결 중…');return;}
  setStatus('연결 중…');
  unsubscribe=onValue(eventsRef, snapshot => {
    const data=snapshot.val()||{};
    events=Object.entries(data).map(([id,value])=>({id,...value}));
    ready=true;setStatus('공용 일정 연결됨');render();
  }, err=>setStatus('일정을 읽지 못함: '+err.message));
});
document.getElementById('admin-login').addEventListener('submit', async e=>{
  e.preventDefault();
  try {await signInWithEmailAndPassword(auth,document.getElementById('admin-email').value,document.getElementById('admin-password').value);document.getElementById('admin-password').value='';authMessage.textContent='관리자 로그인 확인 완료';}
  catch(err){authMessage.textContent='로그인 실패: 이메일과 비밀번호를 확인.';}
});
document.getElementById('logout').onclick=async()=>{await signOut(auth);await signInAnonymously(auth);};
if(!auth.currentUser)signInAnonymously(auth).catch(err=>setStatus('로그인 실패: '+err.message));

