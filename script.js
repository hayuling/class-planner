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
const ADMIN_UID = 'yVsFVH4vIBZICv6608ktfhOfiq03'
let unsubscribe = null;
const loginPanel = document.getElementById('login-panel');
const adminControls = document.getElementById('admin-controls');
const authMessage = document.getElementById('auth-message');
const status = document.getElementById('sync-status');
function setStatus(message) { status.textContent = message; }

let weekStart=startOfWeek(new Date());
let editingId=null;
const calendar=document.getElementById('calendar');
const form=document.getElementById('event-form');
const dateInput=document.getElementById('date');
function startOfWeek(date){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-(d.getDay()+6)%7);return d;}
function addDays(date,n){const d=new Date(date);d.setDate(d.getDate()+n);return d;}
function iso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}

function daysLeft(ymd){const today=new Date();const a=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());const [y,m,d]=ymd.split('-').map(Number);return Math.round((Date.UTC(y,m-1,d)-a)/86400000);}
function render(){const end=addDays(weekStart,6);document.getElementById('range').textContent=`${iso(weekStart)} ~ ${iso(end)}`;calendar.replaceChildren();const names=['월','화','수','목','금','토','일'];for(let i=0;i<7;i++){const day=addDays(weekStart,i);const date=iso(day);const box=document.createElement('div');box.className='day';const heading=document.createElement('div');heading.className='day-head';heading.textContent=`${names[i]} ${day.getMonth()+1}/${day.getDate()}`;box.append(heading);events.filter(e=>e.date===date).forEach(e=>{const item=document.createElement('div');item.className='event';const subject=document.createElement('strong');subject.textContent=e.subject;const task=document.createElement('span');task.textContent=e.task;const remaining=document.createElement('small');const left=daysLeft(e.date);remaining.textContent=left===0?'D-day':left>0?`D-${left}`:`D+${-left}`;const controls=document.createElement('div');controls.className='controls';const edit=document.createElement('button');edit.textContent='수정';edit.onclick=()=>{editingId=e.id;document.getElementById('subject').value=e.subject;document.getElementById('task').value=e.task;dateInput.value=e.date;document.getElementById('form-title').textContent='수행평가 수정';document.getElementById('cancel').hidden=false;form.scrollIntoView({behavior:'smooth'});};const del=document.createElement('button');del.textContent='삭제';del.onclick=async()=>{if(!confirm('이 일정을 삭제할까?'))return;try{await remove(ref(db,`schedules/${e.id}`));}catch(err){alert('삭제 권한이 없거나 연결에 실패했어. '+err.message);}};if(admin)controls.append(edit,del);item.append(subject,task,remaining);if(admin)item.append(controls);box.append(item);});calendar.append(box);}}
form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!ready){alert('아직 데이터베이스 연결 중이야.');return;}
  const subject=document.getElementById('subject').value.trim();
  const task=document.getElementById('task').value.trim();
  const date=dateInput.value;
  if(!subject||!task||!date)return;
  try {
    if(editingId){await update(ref(db,`schedules/${editingId}`),{subject,task,date});}
    else {await set(push(eventsRef),{subject,task,date});}
    resetForm();weekStart=startOfWeek(new Date(`${date}T12:00:00`));render();
  } catch(err){alert('저장할 수 없어. 관리자 권한 또는 보안 규칙을 확인해 줘. '+err.message);}
});
function resetForm(){form.reset();editingId=null;document.getElementById('form-title').textContent='수행평가 추가';document.getElementById('cancel').hidden=true;}
document.getElementById('cancel').onclick=resetForm;
document.getElementById('prev').onclick=()=>{weekStart=addDays(weekStart,-7);render();};
document.getElementById('next').onclick=()=>{weekStart=addDays(weekStart,7);render();};
document.getElementById('today').onclick=()=>{weekStart=startOfWeek(new Date());render();};
dateInput.value=iso(new Date());render();
onAuthStateChanged(auth, user => {
  admin=!!user && !user.isAnonymous && user.uid===ADMIN_UID;
  loginPanel.hidden=admin;adminControls.hidden=!admin;
  if(unsubscribe){unsubscribe();unsubscribe=null;}
  if(!user){ready=false;setStatus('로그인 연결 중…');return;}
  setStatus('연결 중…');
  unsubscribe=onValue(eventsRef, snapshot => {
    const data=snapshot.val()||{};
    events=Object.entries(data).map(([id,value])=>({id,...value}));
    ready=true;setStatus('공용 일정 연결됨');render();
  }, err=>setStatus('일정을 읽지 못했어: '+err.message));
});
document.getElementById('admin-login').addEventListener('submit', async e=>{
  e.preventDefault();
  try {await signInWithEmailAndPassword(auth,document.getElementById('admin-email').value,document.getElementById('admin-password').value);document.getElementById('admin-password').value='';authMessage.textContent='관리자 로그인 확인 완료';}
  catch(err){authMessage.textContent='로그인 실패: 이메일과 비밀번호를 확인해 줘.';}
});
document.getElementById('logout').onclick=async()=>{await signOut(auth);await signInAnonymously(auth);};
if(!auth.currentUser)signInAnonymously(auth).catch(err=>setStatus('로그인 실패: '+err.message));

