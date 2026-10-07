// UUID
function generateId(){return'xxxx-xxxx-xxxx'.replace(/x/g,function(){return Math.floor(Math.random()*16).toString(16)})}
// Date helpers
function formatDate(s){var d=new Date(s),n=new Date(),t=new Date(n.getFullYear(),n.getMonth(),n.getDate()),e=new Date(d.getFullYear(),d.getMonth(),d.getDate()),i=Math.floor((t-e)/864e5);if(i===0)return'今天';if(i===1)return'昨天';if(i===2)return'前天';if(i<7)return i+'天前';return d.getFullYear()+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0')}
function formatTime(s){var d=new Date(s);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function formatDateFull(s){return formatDate(s)+' '+formatTime(s)}
function groupByDate(a){var g={};a.forEach(function(e){var k=formatDate(e.createdAt);if(!g[k])g[k]=[];g[k].push(e)});return g}
function escapeHtml(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML}
function $(s){return document.querySelector(s)}
function $$(s){return document.querySelectorAll(s)}
function copyText(t){if(navigator.clipboard){navigator.clipboard.writeText(t).then(function(){showToast('已复制：'+t,1500)}).catch(function(){prompt('长按复制：',t)})}else{prompt('长按复制：',t)}}
function formatMonthDay(s){var d=new Date(s);return(d.getMonth()+1)+'月'+d.getDate()+'日'}
function showToast(m,d){if(!d)d=2000;var t=$('#toast');if(!t)return;t.textContent=m;t.classList.remove('hidden');requestAnimationFrame(function(){t.classList.add('show')});setTimeout(function(){t.classList.remove('show');setTimeout(function(){t.classList.add('hidden')},300)},d)}
// Mood config
var MOOD_CONFIG={sunny:{icon:'☀️',label:'晴朗',accent:'#F59E0B'},cloudy:{icon:'☁️',label:'多云',accent:'#94A3B8'},rainy:{icon:'🌧️',label:'雨天',accent:'#3B82F6'},storm:{icon:'⛈️',label:'雷暴',accent:'#8B5CF6'},love:{icon:'❤️',label:'爱心',accent:'#F43F5E'},dnd:{icon:'🔕',label:'勿扰',accent:'#9CA3AF'}};
// Global helpers
function getMyCode(){var c=localStorage.getItem('my_pair_code');if(!c){c='';var ch='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';for(var i=0;i<6;i++)c+=ch[Math.floor(Math.random()*ch.length)];localStorage.setItem('my_pair_code',c)}return c}
function copyMyCode(){var c=getMyCode();if(navigator.clipboard){navigator.clipboard.writeText(c).then(function(){var el=document.getElementById('copy-hint');if(el){el.style.display='block';setTimeout(function(){el.style.display='none'},1500)}}).catch(function(){prompt('长按复制：',c)})}else{prompt('长按复制：',c)}}
function editPartnerName(){var c=localStorage.getItem('sync_partnerName')||'TA';var n=prompt('输入TA的称呼：',c);if(n&&n.trim()){var nn=n.trim();localStorage.setItem('sync_partnerName',nn);localStorage.setItem('sync_partnerName_custom','1');if(typeof Sync!=='undefined')Sync.partnerName=nn;if(typeof Weather!=='undefined')Weather.refresh();if(typeof TreeHole!=='undefined')TreeHole.refresh();showToast('已更新为：'+nn,1500)}}
function leaveAndReset(){if(confirm('确定退出房间吗？')){if(typeof Sync!=='undefined')Sync.leave();localStorage.removeItem('room_password');if(typeof App!=='undefined'){App._paired=false;App._updatePairUI()}if(typeof Weather!=='undefined')Weather.refresh();showToast('已退出房间',2000)}}
// v113: 清除本地数据时保留身份与配对信息——旧版 localStorage.clear() 会连 user_id 一起删掉，
// 导致重进时被当成"新身份"，把房间重置、对方被踢。文案承诺的只是"删除记录、涂鸦和设置"。
function clearAllData(){
  if(!confirm('确定清除本地记录、日记和涂鸦吗？（不会退出房间，连接保持不变）'))return;
  var keep=['user_id','sync_userId','sync_roomCode','sync_roomId','sync_partnerId','sync_partnerName','sync_partnerName_custom','my_pair_code'];
  var saved={};
  for(var i=0;i<keep.length;i++){var v=localStorage.getItem(keep[i]);if(v!==null)saved[keep[i]]=v}
  localStorage.clear();
  for(var k in saved){localStorage.setItem(k,saved[k])}
  location.reload();
}
function pickMood(s){var c=MOOD_CONFIG[s]||MOOD_CONFIG.sunny;var d={status:s,updatedAt:new Date().toISOString(),message:''};try{localStorage.setItem('moodState_me',JSON.stringify(d))}catch(e){}if(typeof Sync!=='undefined')Sync.updateMood(s);if(typeof Care!=='undefined')Care.recordMood(s);var colors={sunny:'#FFF8E1',cloudy:'#F1F5F9',rainy:'#EFF6FF',storm:'#F5F3FF',love:'#FFF1F2',dnd:'#FAFAF8'};document.body.style.background=colors[s]||'#FFF7ED';var ie=document.getElementById('mood3d-icon');var le=document.getElementById('mood3d-label');if(ie)ie.textContent=c.icon;if(le)le.textContent=c.label;var os=document.querySelectorAll('.mood3d-opt');for(var i=0;i<os.length;i++){if(os[i].getAttribute('data-mood')===s)os[i].classList.add('selected');else os[i].classList.remove('selected')}if(navigator.vibrate)navigator.vibrate(8);showToast('已更新 '+c.icon,1500)}
function pickSendMood(m){if(typeof Send!=='undefined')Send.sendMood=m;var bs=document.querySelectorAll('#send-mood-select .mood-stamp-btn');for(var i=0;i<bs.length;i++){if(bs[i].getAttribute('data-mood')===m)bs[i].classList.add('selected');else bs[i].classList.remove('selected')}}

// ===== v3: User-first flow =====

// Enter app directly (no pairing required)
function goEnterApp(){
  var n=document.getElementById('auth-name').value.trim();
  if(!n){showToast('请输入你的昵称',1500);return}
  localStorage.setItem('sync_partnerName',n);
  document.getElementById('screen-auth').style.display='none';
  document.getElementById('app').classList.remove('hidden');
  if(typeof Sync!=='undefined') Sync._initUser(function(){});
  if(typeof App!=='undefined'&&App.showApp) App.showApp();
}

// ===== Pairing overlay (triggered from within app) =====

function openPairing(){
  document.getElementById('pairing-overlay').classList.remove('hidden');
  showPairingOptions();
}
function closePairing(){
  document.getElementById('pairing-overlay').classList.add('hidden');
  if(_waitingTimer){clearTimeout(_waitingTimer);_waitingTimer=null}
}
function showPairingOptions(){
  document.getElementById('pairing-options').classList.remove('hidden');
  document.getElementById('pairing-create').classList.add('hidden');
  document.getElementById('pairing-join').classList.add('hidden');
}
function showCreateRoom(){
  document.getElementById('pairing-options').classList.add('hidden');
  document.getElementById('pairing-create').classList.remove('hidden');
  document.getElementById('room-waiting').classList.add('hidden');
  document.getElementById('create-password').value='';
  document.getElementById('create-error').textContent='';
}
function showJoinRoom(){
  document.getElementById('pairing-options').classList.add('hidden');
  document.getElementById('pairing-join').classList.remove('hidden');
  document.getElementById('join-code').value='';
  document.getElementById('join-password').value='';
  document.getElementById('join-error').textContent='';
}
function copyRoomCode(){
  var c=document.getElementById('room-code-display').textContent;
  if(navigator.clipboard){navigator.clipboard.writeText(c).then(function(){var e=document.getElementById('copy-hint');if(e){e.style.display='block';setTimeout(function(){e.style.display='none'},1500)}}).catch(function(){prompt('长按复制：',c)})}else{prompt('长按复制：',c)}
}

var _waitingTimer = null;
// v113: 新房间密码强度——至少 8 位，拒绝常见弱密码（如 1111/6666/123456）。
// 加入房间仍只要求非空，避免把已有 4 位密码的老房间挡在门外。
var WEAK_PASSWORDS=['11111111','12345678','123456789','88888888','66666666','00000000','12341234','11223344','147258369','1234567890','0000000000','qwertyuiop','asdfghjkl;'];
function isWeakPassword(p){return WEAK_PASSWORDS.indexOf(p)!==-1||/^(.)\1{7,}$/.test(p)||/^12345(6789*)?$/.test(p)||/^0?123450/.test(p)}
function doCreateRoom(){
  if(typeof Sync!=='undefined'&&Sync.roomCode){showToast('请先退出当前房间',2000);return}
  var pwd=document.getElementById('create-password').value.trim();
  if(pwd.length<8){document.getElementById('create-error').textContent='密码至少 8 位（现在是你们的私密空间，别用太弱的密码）';return}
  if(isWeakPassword(pwd)){document.getElementById('create-error').textContent='这个密码太常见了，换一个更私密的吧';return}
  var btn=document.querySelector('#pairing-create .btn-primary');if(btn){btn.disabled=true;btn.textContent='创建中…'}
  document.getElementById('create-error').textContent='';
  if(typeof Sync!=='undefined') Sync.createRoom(pwd, function(result){
    if(btn){btn.disabled=false;btn.textContent='创建'}
    if(result.error){document.getElementById('create-error').textContent=result.error;return}
    localStorage.setItem('room_password',pwd);
    closePairing();
    showToast('房间已创建：'+result.roomCode,3000);
    if(typeof App!=='undefined') App._updatePairUI();
    if(typeof Weather!=='undefined') Weather.refresh();
  });
}

function cancelCreate(){
  closePairing();
  // Don't leave room — just close the overlay
}

function doJoinRoom(){
  var code=document.getElementById('join-code').value.trim().toUpperCase();
  var pwd=document.getElementById('join-password').value.trim();
  if(!code){document.getElementById('join-error').textContent='请输入房间号';return}
  if(!pwd||pwd.length<4){document.getElementById('join-error').textContent='密码至少4位';return}
  document.getElementById('join-error').textContent='';
  if(typeof Sync!=='undefined') Sync.joinRoom(code, pwd, function(result){
    if(result.error){document.getElementById('join-error').textContent=result.error;return}
    onPaired();
  });
}

function onPaired(){
  if(_waitingTimer){clearTimeout(_waitingTimer);_waitingTimer=null}
  document.getElementById('pairing-overlay').classList.add('hidden');
  showToast('小窝搭建好了 🏠',2500);
  if(typeof App!=='undefined') App.onPaired();
}

// Legacy
function goRoomStep(){goEnterApp()}
function goNameStep(){document.getElementById('screen-auth').style.display='flex';document.getElementById('auth-step-name').classList.remove('hidden')}
function doJoin(){doJoinRoom()}
