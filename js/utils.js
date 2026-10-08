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
function pickMood(s){var c=MOOD_CONFIG[s]||MOOD_CONFIG.sunny;var prev=getMoodState('me');var note=prev.message||'';var d={status:s,updatedAt:new Date().toISOString(),message:note};try{localStorage.setItem('moodState_me',JSON.stringify(d))}catch(e){}if(typeof Sync!=='undefined')Sync.updateMood(s,note);if(typeof Care!=='undefined')Care.recordMood(s);var colors={sunny:'#FFF8E1',cloudy:'#F1F5F9',rainy:'#EFF6FF',storm:'#F5F3FF',love:'#FFF1F2',dnd:'#FAFAF8'};document.body.style.background=colors[s]||'#FFF7ED';var ie=document.getElementById('mood3d-icon');var le=document.getElementById('mood3d-label');if(ie)ie.textContent=c.icon;if(le)le.textContent=c.label;var os=document.querySelectorAll('.mood3d-opt');for(var i=0;i<os.length;i++){if(os[i].getAttribute('data-mood')===s)os[i].classList.add('selected');else os[i].classList.remove('selected')}if(navigator.vibrate)navigator.vibrate(8);showToast('已更新 '+c.icon,1500)}
// v114: pickSendMood 已随 #send-overlay 一并移除（投递入口改由对话页输入栏承担）

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
  var sc=document.getElementById('pairing-scan');if(sc)sc.classList.add('hidden');
  document.getElementById('join-code').value='';
  document.getElementById('join-password').value='';
  document.getElementById('join-error').textContent='';
  var h=document.getElementById('join-invite-hint');if(h)h.classList.add('hidden');
  // 若来自邀请链接，自动填房间号并聚焦密码框
  var pre=_readInviteCode()||_pendingInviteCode;
  if(pre){document.getElementById('join-code').value=pre;if(h)h.classList.remove('hidden');
    var jp=document.getElementById('join-password');if(jp)setTimeout(function(){jp.focus()},200)}
}
function copyRoomCode(){
  var c=document.getElementById('room-code-display').textContent;
  if(navigator.clipboard){navigator.clipboard.writeText(c).then(function(){var e=document.getElementById('copy-hint');if(e){e.style.display='block';setTimeout(function(){e.style.display='none'},1500)}}).catch(function(){prompt('长按复制：',c)})}else{prompt('长按复制：',c)}
}

// ===== v114: 邀请链接 + 二维码配对 =====

function _inviteUrl(code){
  code=(code||'').toUpperCase();
  var base=location.href.split('#')[0].split('?')[0];
  return base+'?join='+encodeURIComponent(code)+'#join';
}
function _readInviteCode(){
  try{
    var m=location.search.match(/[?&]join=([A-Za-z0-9]+)/);
    if(m)return m[1].toUpperCase();
    var h=location.hash.match(/join[=\/]([A-Za-z0-9]+)/);
    if(h)return h[1].toUpperCase();
  }catch(e){}
  return '';
}
// 只认自家域名下带 ?join= 的链接，避免被陌生人链接带跑
function _parseInviteCode(text){
  if(!text)return '';
  text=String(text).trim();
  var m=text.match(/[?&]join=([A-Za-z0-9]{4,10})/);
  if(m)return m[1].toUpperCase();
  if(/^[A-Za-z0-9]{6}$/.test(text))return text.toUpperCase();
  try{
    var u=new URL(text);
    if(u.host===location.host){
      var j=u.searchParams.get('join');
      if(j)return j.toUpperCase();
    }
  }catch(e){}
  return '';
}

function shareInviteLink(){
  var code=Sync&&Sync.roomCode;if(!code){showToast('还没创建房间');return}
  var url=_inviteUrl(code);
  var text='来我们的小窝吧：'+url;
  if(navigator.share){
    navigator.share({title:'心情气象台',text:'一起来记录我们的心情吧',url:url}).catch(function(){copyText(url)});
  }else{
    copyText(url);
  }
}

// --- 极简 QR 生成（byte mode, EC level L, 版本 1-10）---
// 参数表是权威值（QR Model 2, EC level L）：
//   ver: [数据码字数, 每块 EC 码字数, 块数]
// 总码字 = 数据码字 + EC/块 × 块数，必须等于该版本的数据模块位数 / 8。
var _QR_SPEC = {
  1:  [19,  7,  1],   2:  [34,  10, 1],   3:  [55,  15, 1],   4:  [80,  20, 1],   5:  [108, 26, 1],
  6:  [136, 18, 2],   7:  [156, 20, 2],   8:  [194, 24, 2],   9:  [232, 30, 2],   10: [274, 18, 2]
};
var _QR = {
  _exp:function(){var t=[],v=1;for(var i=0;i<8;i++){t.push(v);v=(v<<1)^(v&0x80?0x11D:0)}return t}(),
  _mul:function(a,b){var r=0;while(b>0){if(b&1)r^=a;b>>=1;a<<=1;if(a&0x100)a^=0x11D}return r},
  _rsGen:function(n){var g=[1];for(var i=0;i<n;i++){var ng=new Array(g.length+1);for(var k=0;k<ng.length;k++)ng[k]=0;for(var j=0;j<g.length;j++){ng[j]^=this._mul(g[j],1);ng[j+1]^=this._mul(g[j],this._exp[i])}g=ng}return g},
  _rsRem:function(data,n){var gen=this._rsGen(n);var res=data.concat(new Array(n).fill(0));for(var i=0;i<data.length;i++){var co=res[i];if(co){for(var j=0;j<gen.length;j++)res[i+j]^=this._mul(gen[j],co)}}return res.slice(data.length)},
  // 版本选择：bytes 长度 + 模式指示(4bit) + 长度域(8bit) 必须放得进数据码字数
  encode:function(text){
    var bytes=[];
    for(var i=0;i<text.length;i++){
      var c=text.charCodeAt(i);
      if(c<128)bytes.push(c);
      else if(c<2048)bytes.push(0xC0|(c>>6),0x80|(c&63));
      else bytes.push(0xE0|(c>>12),0x80|((c>>6)&63),0x80|(c&63));
    }
    var ver=-1;
    for(var v=1;v<=10;v++){
      var capCw=_QR_SPEC[v][0];
      // 数据码字容量换算成可容纳的字节数：总位 - 4(模式) - 8(长度)
      if(bytes.length <= capCw - 2){ver=v;break}   // 2 字节 = 12 位向上取整
    }
    if(ver<0)return null;
    var cap=_QR_SPEC[ver][0];
    var bits=[];
    function put(val,len){for(var b=len-1;b>=0;b--)bits.push((val>>b)&1)}
    put(4,4);put(bytes.length,8);
    for(var bi=0;bi<bytes.length;bi++)put(bytes[bi],8);
    // 终止符 + 补齐到字节边界
    var term=Math.min(4,cap*8-bits.length);for(var t=0;t<term;t++)bits.push(0);
    while(bits.length%8!==0)bits.push(0);
    var dbytes=[];for(var k=0;k<bits.length;k+=8){var val=0;for(var m=0;m<8;m++)val=(val<<1)|bits[k+m];dbytes.push(val)}
    var pads=[0xEC,0x11],pi=0;
    while(dbytes.length<cap){dbytes.push(pads[pi%2]);pi++}
    // 分块 + RS 纠错 + 交织
    var ecb=_QR_SPEC[ver][1], nb=_QR_SPEC[ver][2];
    var per=Math.floor(cap/nb), extra=cap%nb;
    var blocks=[],ecs=[],pos=0;
    for(var b2=0;b2<nb;b2++){
      var sz=per+(b2>=nb-extra?1:0);
      var blk=dbytes.slice(pos,pos+sz);pos+=sz;
      blocks.push(blk);ecs.push(this._rsRem(blk,ecb));
    }
    var out=[],maxD=0;
    for(var z=0;z<blocks.length;z++)if(blocks[z].length>maxD)maxD=blocks[z].length;
    for(var x=0;x<maxD;x++)for(var y=0;y<blocks.length;y++)if(x<blocks[y].length)out.push(blocks[y][x]);
    for(var e=0;e<ecb;e++)for(var w=0;w<blocks.length;w++)out.push(ecs[w][e]);
    var size=17+ver*4;
    return {data:out,size:size,ver:ver};
  },

  _funcs:{},
  // 功能模块布局必须与 js/qrdecode.js 的 QRDecode._isFunc 完全一致，
  // 否则编码放进数据的位置和解码取出的位置会错位。这里直接复用解码端实现；
  // 若解码脚本未加载，则退回本文件内的等价实现。
  _isFuncAt:function(r,c,size,ver){
    if(typeof QRDecode!=='undefined'&&QRDecode._isFunc)return QRDecode._isFunc(r,c,size,ver);
    if(r<=8&&c<=8)return true;
    if(r<=8&&c>=size-8)return true;
    if(r>=size-8&&c<=8)return true;
    if(r===6||c===6)return true;
    if(ver>=2){var a=size-7;if(Math.abs(r-a)<=2&&Math.abs(c-a)<=2)return true}
    return false;
  },
  _buildMatrix:function(qr){
    var size=qr.size,g=[],r,c,ver=qr.ver;
    for(r=0;r<size;r++){g.push(new Array(size).fill(null))}
    var isFunc=[];
    for(r=0;r<size;r++)isFunc.push(new Array(size).fill(false));
    for(r=0;r<size;r++)for(c=0;c<size;c++)isFunc[r][c]=this._isFuncAt(r,c,size,ver);
    // finder（左上/右上/左下）
    function finder(rs,cs){
      for(var i=0;i<7;i++)for(var j=0;j<7;j++){
        var rr=rs+i,cc=cs+j;if(rr<0||rr>=size||cc<0||cc>=size)continue;
        var on=(i===0||i===6||j===0||j===6)||(i>=2&&i<=4&&j>=2&&j<=4);
        g[rr][cc]=on?1:0;
      }
    }
    finder(0,0);finder(0,size-7);finder(size-7,0);
    // 时序图案
    for(var ti=8;ti<size-8;ti++){
      g[6][ti]=(ti%2===0)?1:0;
      g[ti][6]=(ti%2===0)?1:0;
    }
    // alignment pattern（版本 2+，中心 size-7）
    if(ver>=2){
      var a=size-7;
      for(var ii=-2;ii<=2;ii++)for(var jj=-2;jj<=2;jj++){
        var on2=(Math.abs(ii)===2||Math.abs(jj)===2||(ii===0&&jj===0));
        g[a+ii][a+jj]=on2?1:0;
      }
    }
    // 数据 + 掩码（mask 0: (r+c)%2===0 取反）
    var dir=-1,col=size-1,bitIdx=0,data=qr.data;
    function nextBit(){var b=(data[bitIdx>>3]>>(7-(bitIdx&7)))&1;bitIdx++;return b}
    while(col>0){
      if(col===6)col--;
      for(var i2=0;i2<size;i2++){
        var row=(dir<0)?(size-1-i2):i2;
        for(var k2=0;k2<2;k2++){
          var c2=col-k2;
          if(isFunc[row][c2])continue;
          var mask=((row+c2)%2===0);
          var bit=bitIdx<data.length*8?nextBit():0;
          g[row][c2]=mask?(bit^1):bit;
        }
      }
      dir=-dir;col-=2;
    }
    // 格式信息（EC level L = 01, mask 0）
    var fmt=_formatBits(1,0);
    var seq=[];
    for(var fbi=14;fbi>=0;fbi--)seq.push((fmt>>fbi)&1);
    var places1=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
    for(var p=0;p<15;p++){var pp=places1[p];g[pp[0]][pp[1]]=seq[p]}
    var places2=[[size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],[8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2],[8,size-1]];
    for(var q=0;q<15;q++){var qq=places2[q];g[qq[0]][qq[1]]=seq[q]}
    // 固定黑模块
    g[size-8][8]=1;
    return g;
  }
};
// BCH(15,5) format bits for EC level L(mask pattern 000)
function _formatBits(ecBits,mask){
  var data=(ecBits<<3)|mask;
  var d=data<<10;
  var g=0x537;
  for(var i=4;i>=0;i--){if(d&(1<<(i+10)))d^=g<<i}
  return ((data<<10)|d)^0x5412;
}
function renderQR(el,text){
  if(!el)return false;
  var qr=_QR.encode(text);
  if(!qr){el.innerHTML='<span style="font-size:11px;color:#666">链接太长</span>';return false}
  var g=_QR._buildMatrix(qr),n=qr.size;
  var html='<svg viewBox="0 0 '+n+' '+n+'" width="190" height="190" shape-rendering="crispEdges">';
  html+='<rect width="'+n+'" height="'+n+'" fill="#fff"/>';
  for(var r=0;r<n;r++)for(var c=0;c<n;c++){if(g[r][c])html+='<rect x="'+c+'" y="'+r+'" width="1" height="1" fill="#000"/>'}
  html+='</svg>';
  el.innerHTML=html;return true;
}

// --- 扫码 ---
var _scanStream=null;
function openScanJoin(){
  document.getElementById('pairing-options').classList.add('hidden');
  document.getElementById('pairing-join').classList.add('hidden');
  document.getElementById('pairing-scan').classList.remove('hidden');
  var se=document.getElementById('scan-error');if(se)se.textContent='';
  var f=document.getElementById('scan-file');
  if(f&&!f._bound){f._bound=true;f.addEventListener('change',function(){_scanImageFile(this)})}
  startScan();
}
function startScan(){
  document.getElementById('pairing-options').classList.add('hidden');
  document.getElementById('pairing-join').classList.add('hidden');
  document.getElementById('pairing-scan').classList.remove('hidden');
  var v=document.getElementById('scan-video');
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    var se=document.getElementById('scan-error');if(se)se.textContent='这个浏览器不支持相机，用「从相册选二维码」吧';
    return;
  }
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(function(s){
    _scanStream=s;v.srcObject=s;v.play();
    _scanLoop();
  }).catch(function(){
    var se=document.getElementById('scan-error');if(se)se.textContent='拿不到相机权限，用「从相册选二维码」吧';
  });
}
function stopScan(){
  if(_scanStream){try{_scanStream.getTracks().forEach(function(t){t.stop()})}catch(e){}_scanStream=null}
}
function _scanLoop(){
  var v=document.getElementById('scan-video');
  if(!v||!_scanStream)return;
  var cv=document.createElement('canvas');
  var tick=function(){
    if(!_scanStream)return;
    if(v.readyState===v.HAVE_ENOUGH_DATA){
      cv.width=v.videoWidth;cv.height=v.videoHeight;
      var ctx=cv.getContext('2d');ctx.drawImage(v,0,0);
      try{
        var code=_decodeQRFromCanvas(cv,ctx);
        if(code){var rc=_parseInviteCode(code);if(rc){stopScan();closePairing();_pendingInviteCode=rc;openPairing();showJoinRoom();showToast('已识别房间号 '+rc,2000);return}}
      }catch(e){}
    }
    setTimeout(tick,400);
  };
  tick();
}
function _scanImageFile(input){
  var f=input.files&&input.files[0];if(!f)return;
  var se=document.getElementById('scan-error');
  var img=new Image(),fr=new FileReader();
  fr.onload=function(){img.onload=function(){
    var cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
    var ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
    var code=_decodeQRFromCanvas(cv,ctx);
    var rc=code?_parseInviteCode(code):'';
    if(rc){stopScan();closePairing();_pendingInviteCode=rc;openPairing();showJoinRoom();showToast('已识别房间号 '+rc,2000)}
    else if(se)se.textContent='没认出二维码，换一张清晰的试试';
  };img.src=fr.result};
  fr.readAsDataURL(f);
  input.value='';
}

var _pendingInviteCode='';
function applyInviteFromUrl(){
  var c=_readInviteCode();
  if(c){_pendingInviteCode=c;return true}
  return false;
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
    // v114: 创建成功后展开等待区，并渲染二维码（扫一下就能进，不用手输房间号）
    var waiting=document.getElementById('room-waiting');
    if(waiting) waiting.classList.remove('hidden');
    var disp=document.getElementById('room-code-display');
    if(disp) disp.textContent=result.roomCode;
    var qrel=document.getElementById('pair-qr');
    if(qrel){
      var ok=renderQR(qrel,_inviteUrl(result.roomCode));
      if(!ok) qrel.innerHTML='';
    }
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
