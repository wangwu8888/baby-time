var Weather={activeMood:'sunny',init:function(){this.render();this._checkGreeting()},render:function(){this.renderStatus();this.renderMyMood();this.renderPartnerMood();this.renderRoomBadge();this._applyMoodBg()},

_applyMoodBg:function(){
  var m=Sync.myMood||getMoodState('me');
  var colors={sunny:'#FFF8E1',cloudy:'#F1F5F9',rainy:'#EFF6FF',storm:'#F5F3FF',love:'#FFF1F2',dnd:'#FAFAF8'};
  document.body.style.background=colors[m.status]||'#FFF7ED';
  document.body.style.transition='background 1s ease';
},

// Daily greeting on first open
_checkGreeting:function(){
  var today=new Date().toDateString();
  var last=localStorage.getItem('last_greeting_date');
  if(last===today)return;
  localStorage.setItem('last_greeting_date',today);
  var h=new Date().getHours(),greeting='';
  if(h>=6&&h<12)greeting='早安 ☀️';
  else if(h>=12&&h<18)greeting='下午好 🌤️';
  else greeting='晚上好 🌙';
  // Late night care
  if(h>=0&&h<5)greeting='这么晚还没睡？🌙 记得照顾好自己';
  showToast(greeting,3000);
},

// Status area
renderStatus:function(){
  var el=document.getElementById('status-area');if(!el)return;
  var paired=!!Sync.partnerId,hasRoom=!!Sync.roomCode;
  if(paired){
    var pn=localStorage.getItem('sync_partnerName')||'TA';
    var days=this._getTogetherDays();
    el.innerHTML='<div style="text-align:center;padding:8px 0;font-size:13px"><span style="color:var(--accent-green);font-weight:500">💞 '+pn+'</span><span style="color:var(--text-dim);margin-left:8px">在一起 '+days+' 天</span></div>';
  }else if(hasRoom){
    var code=Sync.roomCode,pwd=localStorage.getItem('room_password')||'';
    el.innerHTML='<div class="card" style="text-align:center"><div style="font-size:32px;margin-bottom:4px">⏳</div><p style="font-size:14px;color:var(--text-secondary)">等待TA加入…</p><div class="my-code-box"><span>房间号（点击复制）</span><strong style="cursor:pointer" onclick="copyText(\''+code+'\')">'+code+'</strong></div>'+(pwd?'<p style="font-size:12px;color:var(--text-dim);cursor:pointer" onclick="copyText(\''+pwd+'\')">密码：'+pwd+'（点击复制）</p>':'')+'<button class="btn-text btn-danger" onclick="leaveAndReset()">退出房间</button></div>';
  }else{
    el.innerHTML='<div class="card" style="text-align:center"><p style="font-size:15px;color:var(--text-secondary);padding:12px 0">邀请TA创建属于你们的小窝吧</p><div style="display:flex;gap:8px;justify-content:center"><button class="btn-primary" onclick="openPairing();showCreateRoom()">🏠 创建小窝</button><button class="btn-secondary" onclick="openPairing();showJoinRoom()">🔑 加入小窝</button></div></div>';
  }
},

// Timeline (paired only)
renderTimeline:function(){
  var el=document.getElementById('timeline-area');if(!el)return;
  var paired=!!Sync.partnerId;
  if(!paired){el.innerHTML='';return}
  var ms=Sync.partnerMessages.length?Sync.partnerMessages:[];
  var myMood=Sync.myMood||getMoodState('me');
  if(!ms.length&&!myMood.updatedAt){el.innerHTML='<div class="card"><p class="empty-hint">还没有消息，分享第一条心情吧</p></div>';return}

  var items=[];
  ms.forEach(function(m){items.push({type:m.type||'text',text:m.text,doodleDataUrl:m.doodleDataUrl,mood:m.mood,createdAt:m.createdAt||m.created_at,sender:m.sender||'partner'})});
  if(!items.length){el.innerHTML='<div class="card"><p class="empty-hint">等TA分享点什么吧</p></div>';return}

  items.sort(function(a,b){return new Date(a.createdAt)-new Date(b.createdAt)});
  var groups=groupByDate(items);
  el.innerHTML='';
  var card=document.createElement('div');card.className='card';
  card.innerHTML='<div class="card-title" style="display:flex;justify-content:space-between;align-items:center"><span>💬 对话</span><span style="font-size:11px;color:var(--accent-warm);cursor:pointer;font-weight:400" onclick="Weekly._openReport();event.stopPropagation()">📊 周报</span></div>';
  var scroll=document.createElement('div');scroll.style.cssText='flex:1;overflow-y:auto;min-height:300px';
  scroll.id='timeline-scroll';

  var self=this;
  Object.keys(groups).forEach(function(day){
    var dl=document.createElement('div');dl.style.cssText='text-align:center;padding:8px 0;font-size:11px;color:var(--text-dim)';dl.textContent=day;scroll.appendChild(dl);
    groups[day].forEach(function(it){
      var moodIcon=MOOD_CONFIG[it.mood]?MOOD_CONFIG[it.mood].icon:'';
      var row=document.createElement('div');
      if(it.type==='mood_change'){
        // Only show partner's mood changes, skip my own
        if(it.sender==='me')return;
        var pn=localStorage.getItem('sync_partnerName')||'TA';
        row.style.cssText='text-align:center;padding:4px 0;font-size:12px;color:var(--text-dim)';
        row.textContent=pn+' '+moodIcon+' 心情更新';
      }else{
        var isPartner=it.sender!=='me';
        row.style.cssText='margin-bottom:6px;text-align:'+(isPartner?'left':'right');
        var bubble=document.createElement('div');
        bubble.style.cssText='display:inline-block;max-width:80%;background:'+(isPartner?'var(--card)':'var(--primary)')+';color:'+(isPartner?'var(--text)':'white')+';padding:8px 12px;border-radius:12px;font-size:13px;word-break:break-word;box-shadow:'+(isPartner?'var(--shadow)':'none');
        if(it.type==='doodle'){
          var img=document.createElement('img');img.src=it.doodleDataUrl;img.style.cssText='max-width:120px;border-radius:8px;cursor:pointer';
          img.addEventListener('click',function(){self._showFull(it.doodleDataUrl)});
          bubble.appendChild(img);
        }else{
          var txt=it.text||'';if(txt.length>100)txt=txt.substring(0,100)+'…';
          bubble.textContent=txt;
        }
        bubble.addEventListener('click',function(){showToast(moodIcon+' '+formatDateFull(it.createdAt),2500)});
        bubble.style.cursor='pointer';
        row.appendChild(bubble);
      }
      scroll.appendChild(row);
    });
  });
  card.appendChild(scroll);el.appendChild(card);
  setTimeout(function(){scroll.scrollTop=scroll.scrollHeight},100);
},

// Input bar (paired only)
renderInputBar:function(){
  var el=document.getElementById('input-bar-area');if(!el)return;
  var paired=!!Sync.partnerId;
  if(!paired){el.innerHTML='';return}
  el.innerHTML='<div style="display:flex;gap:8px;padding:8px 0;align-items:center"><input id="msg-input" placeholder="说点什么…" style="flex:1;padding:10px 16px;border:1px solid var(--border);border-radius:24px;font-size:15px;font-family:var(--font);background:var(--bg-card);color:var(--text-primary);outline:none" onkeydown="if(event.key===\'Enter\')Weather.sendMsg()"><button class="btn-primary" onclick="Weather.sendMsg()" style="border-radius:24px;padding:10px 16px;flex-shrink:0">发送</button><button class="btn-secondary" onclick="Doodle.openSendMode()" style="border-radius:24px;flex-shrink:0">🎨</button></div>';
},

sendMsg:function(){
  var inp=document.getElementById('msg-input');if(!inp)return;
  var t=inp.value.trim();if(!t)return;
  if(!Sync.roomCode||!Sync.userId){showToast('未连接，请先配对');return}
  var self=this;
  Sync.sendMessage(t,null,'sunny').then(function(r){
    if(r&&r.error){showToast('发送失败，请重试');return}
    inp.value='';
    showToast('已发送',1500);
    setTimeout(function(){self.refresh()},500);
  });
},

_showFull:function(src){
  var d=document.createElement('div');d.className='doodle-fullscreen';
  d.innerHTML='<img src="'+src+'" alt="查看">';
  d.addEventListener('click',function(){d.remove()});document.body.appendChild(d);
},

renderMyMood:function(){var m=Sync.myMood||getMoodState('me');var c=MOOD_CONFIG[m.status]||MOOD_CONFIG.sunny;this.activeMood=m.status;var ie=document.getElementById('mood3d-icon');if(ie)ie.textContent=c.icon;var le=document.getElementById('mood3d-label');if(le)le.textContent=c.label;var os=document.querySelectorAll('.mood3d-opt');for(var i=0;i<os.length;i++){os[i].classList.toggle('selected',os[i].getAttribute('data-mood')===this.activeMood)}},
renderPartnerMood:function(){var pm=Sync.partnerMood||getMoodState('ta');var c=MOOD_CONFIG[pm.status]||MOOD_CONFIG.sunny;var pie=document.getElementById('partner-mood-icon');if(pie)pie.textContent=c.icon;var ple=document.getElementById('partner-mood-label');if(ple)ple.textContent=c.label;var pn=this._partnerName();var t=document.getElementById('partner-mood-title');if(t)t.textContent=pn+'的心情';var u=document.getElementById('partner-mood-updated');if(u)u.textContent=pm.updatedAt?formatDate(pm.updatedAt)+'更新':'尚未更新'},
renderRoomBadge:function(){var b=document.getElementById('room-badge');if(!b)return;if(Sync.roomCode){b.textContent=(Sync.partnerId?'💞':'⏳')+' #'+Sync.roomCode;b.style.display='inline'}else{b.style.display='none'}},
_partnerName:function(){return localStorage.getItem('sync_partnerName')||'TA'},
_getTogetherDays:function(){
  var start=localStorage.getItem('paired_since');
  if(!start){start=new Date().toISOString();localStorage.setItem('paired_since',start)}
  return Math.floor((new Date()-new Date(start))/86400000)+1;
},
refresh:function(){this.render()}
};
