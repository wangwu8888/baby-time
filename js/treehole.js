var TreeHole={selectedMood:'sunny',pendingDoodle:null,_diaryOpen:false,_annOpen:false,_wishOpen:false,_sharedDiaryOpen:false,_expanded:{},_sharedMonths:{},init:function(){this.render()},pickStamp:function(m){this.selectedMood=m;var bs=document.querySelectorAll('#entry-mood-select .mood-stamp-btn');for(var i=0;i<bs.length;i++){bs[i].classList.toggle('selected',bs[i].getAttribute('data-mood')===m)}},

render:function(){this.renderSharedDiaries();this.renderDiary()},

_toggleSharedDiary:function(){this._sharedDiaryOpen=!this._sharedDiaryOpen;this.renderSharedDiaries()},
_toggleSharedMonth:function(mk){this._sharedMonths[mk]=!this._sharedMonths[mk];this.renderSharedDiaries()},

renderSharedDiaries:function(){
  var el=document.getElementById('shared-diary-section');if(!el)return;
  if(typeof Sync==='undefined'||!Sync.partnerId){el.innerHTML='';return}
  var self=this;
  var sds=[];
  try{sds=JSON.parse(localStorage.getItem('shared_diaries')||'[]')}catch(e){}
  var unread=0;
  for(var i=0;i<sds.length;i++){if(!sds[i].read)unread++}
  var html='<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="TreeHole._toggleSharedDiary()"><div class="card-title" style="margin:0">📬 TA分享的日记'+(unread>0?' <span style="display:inline-block;width:8px;height:8px;background:#F43F5E;border-radius:50%;vertical-align:middle;margin-left:2px"></span>':'')+'</div><span id="shared-diary-toggle" class="btn-text" style="font-size:12px">'+(this._sharedDiaryOpen?'收起':'展开')+'</span></div>';
  html+='<div id="shared-diary-body" style="'+(this._sharedDiaryOpen?'':'display:none')+'">';
  if(!sds.length){
    html+='<p class="empty-hint">还没有收到TA分享的日记</p>';
  }else{
    // Group by month
    var months={};
    sds.forEach(function(sd){
      var d=new Date(sd.createdAt);
      var key=d.getFullYear()+'年'+(d.getMonth()+1)+'月';
      if(!months[key])months[key]=[];
      months[key].push(sd);
    });
    var monthKeys=Object.keys(months).sort().reverse(); // newest first
    monthKeys.forEach(function(mk){
      var isOpen=!!self._sharedMonths[mk];
      var monthUnread=0;
      months[mk].forEach(function(sd){if(!sd.read)monthUnread++});
      html+='<div style="margin-bottom:4px"><div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--bg-secondary);border-radius:8px;cursor:pointer;font-size:13px;font-weight:500" onclick="TreeHole._toggleSharedMonth(\''+mk+'\')">';
      html+='<span>'+mk+' ('+months[mk].length+'篇)'+(monthUnread>0?' <span style="display:inline-block;width:6px;height:6px;background:#F43F5E;border-radius:50%;vertical-align:middle"></span>':'')+'</span>';
      html+='</div>';
      if(isOpen){
        html+='<div style="padding-left:4px">';
        months[mk].forEach(function(sd){
          var idx=sds.indexOf(sd);
          var m=MOOD_CONFIG[sd.mood]||MOOD_CONFIG.sunny;
          var preview=sd.text||'';
          if(preview.length>40)preview=preview.substring(0,40)+'…';
          html+='<div class="card" style="padding:10px 12px;margin-bottom:2px;border-left:3px solid '+m.accent+';cursor:pointer" onclick="TreeHole._viewSharedDiary('+idx+')"><div style="display:flex;justify-content:space-between;margin-bottom:2px"><span style="font-size:13px;font-weight:500">'+m.icon+' '+formatMonthDay(sd.createdAt)+'</span><span style="font-size:11px;color:var(--text-dim)">'+formatTime(sd.createdAt)+'</span></div>';
          html+='<div style="font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(preview)+'</div>';
          if(sd.doodleDataUrl)html+='<span style="font-size:14px">🎨</span> ';
          html+='<span style="font-size:10px;color:'+(sd.read?'var(--accent-green)':'var(--accent-warm)')+'">'+(sd.read?'✓':'●')+'</span>';
          html+='</div>';
        });
        html+='</div>';
      }
      html+='</div>';
    });
  }
  html+='</div></div>';
  el.innerHTML=html;
},

_viewSharedDiary:function(i){
  var sds=[];
  try{sds=JSON.parse(localStorage.getItem('shared_diaries')||'[]')}catch(e){}
  var sd=sds[i];if(!sd)return;
  if(!sd.read){
    sds[i].read=true;localStorage.setItem('shared_diaries',JSON.stringify(sds));
    this.renderSharedDiaries();
    // Notify sharer that diary was read
    if(typeof Sync!=='undefined'&&Sync.roomCode) Sync.sendDiaryRead(sd.id);
  }
  var m=MOOD_CONFIG[sd.mood]||MOOD_CONFIG.sunny;
  var pn=localStorage.getItem('sync_partnerName')||'TA';
  var modal=document.createElement('div');modal.className='modal';modal.style.display='flex';
  var dd=sd.doodleDataUrl?'<img src="'+sd.doodleDataUrl+'" style="max-width:100%;border-radius:12px;margin-top:8px">':'';
  modal.innerHTML='<div class="modal-backdrop" style="position:fixed"></div><div class="modal-card"><h3>📖 '+pn+'的日记</h3><div style="font-size:36px;text-align:center">'+m.icon+'</div><div style="font-size:14px;color:var(--text-dim);text-align:center">'+formatDateFull(sd.createdAt)+'</div><div style="font-size:15px;line-height:1.6;white-space:pre-wrap;margin-top:8px">'+escapeHtml(sd.text)+'</div>'+dd+'<button class="btn-secondary btn-full" style="margin-top:12px">关闭</button></div>';
  document.body.appendChild(modal);
  modal.querySelector('button').addEventListener('click',function(){modal.remove()});
  modal.querySelector('.modal-backdrop').addEventListener('click',function(){modal.remove()});
},

renderDiary:function(){
  var el=document.getElementById('diary-section');if(!el)return;
  var es=getEntries('me');
  var self=this;
  var html='<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="TreeHole._toggleDiary()"><div class="card-title" style="margin:0">📖 我的日记</div><span id="diary-toggle" class="btn-text" style="font-size:12px">'+(this._diaryOpen?'收起':'展开')+'</span></div>';
  html+='<div id="diary-body" style="'+(this._diaryOpen?'':'display:none')+'">';
  html+='<textarea id="entry-text" class="entry-textarea" placeholder="写点什么吧…" rows="3"></textarea>';
  html+='<div class="entry-mood-select" id="entry-mood-select" style="display:flex;gap:6px;margin:8px 0">';
  Object.keys(MOOD_CONFIG).forEach(function(k){html+='<div class="mood-stamp-btn'+(k=='sunny'?' selected':'')+'" data-mood="'+k+'" onclick="TreeHole.pickStamp(\''+k+'\')">'+MOOD_CONFIG[k].icon+'</div>'});
  html+='</div><div style="display:flex;gap:8px"><button class="btn-secondary" onclick="Doodle.open()">🎨 涂鸦</button><button class="btn-primary" onclick="TreeHole.saveEntry()" style="flex:1">存入树洞</button></div>';
  if(!es.length){html+='<p class="empty-hint">还没有日记，写下第一条吧</p>'}
  else{
    var gs=groupByDate(es);
    Object.keys(gs).forEach(function(day){
      html+='<div class="date-group-label">'+day+'</div>';
      gs[day].forEach(function(e,i){
        var m=MOOD_CONFIG[e.mood]||MOOD_CONFIG.sunny;
        var preview=(e.text||'');if(preview.length>35)preview=preview.substring(0,35)+'…';
        var isExpanded=!!self._expanded[e.id];
        html+='<div class="diary-row" style="border-left:3px solid '+m.accent+';padding:8px 12px;margin-bottom:4px;background:var(--bg-card);border-radius:0 8px 8px 0;cursor:pointer" onclick="TreeHole._toggleEntry(\''+e.id+'\')">';
        html+='<div style="display:flex;align-items:center;justify-content:space-between">';
        html+='<span style="font-size:14px">'+m.icon+' <span style="font-size:12px;color:var(--text-dim)">'+formatMonthDay(e.createdAt)+'</span></span>';
        html+='</div>';
        if(!isExpanded){
          html+='<div style="font-size:13px;color:var(--text);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(preview||'(空)')+'</div>';
          if(e.doodleDataUrl)html+='<span style="font-size:12px">🎨</span> ';
          if(e.shared)html+='<span style="font-size:10px;color:'+(e.read?'var(--accent-green)':'var(--text-dim)')+'">'+(e.read?'✓ 已读':'已分享')+'</span>';
        }else{
          if(e.text)html+='<div style="font-size:14px;line-height:1.5;white-space:pre-wrap;margin-top:6px">'+escapeHtml(e.text)+'</div>';
          if(e.doodleDataUrl)html+='<div style="margin-top:6px"><img src="'+e.doodleDataUrl+'" style="max-width:120px;border-radius:8px;cursor:pointer" onclick="event.stopPropagation();TreeHole._showFull(\''+e.doodleDataUrl+'\')"></div>';
          html+='<div style="font-size:11px;color:var(--text-dim);margin-top:4px">'+formatTime(e.createdAt)+'</div>';
          html+='<div style="margin-top:6px;display:flex;gap:6px;justify-content:flex-end" onclick="event.stopPropagation()">';
          html+='<button class="btn-text" style="font-size:11px" onclick="TreeHole._editEntry(\''+e.id+'\')">✏️</button>';
          html+='<button class="btn-text btn-danger" style="font-size:11px" onclick="TreeHole._deleteEntry(\''+e.id+'\')">🗑️</button>';
          if(typeof Sync!=='undefined'&&Sync.partnerId){html+='<button class="share-btn'+(e.shared?' shared':'')+'" style="font-size:11px" onclick="TreeHole._toggleShare(\''+e.id+'\')">'+(e.shared?'已分享':'分享给TA')+'</button>'}
          html+='</div>';
        }
        html+='</div>';
      });
    });
  }
  html+='</div></div>';
  el.innerHTML=html;
},

_toggleDiary:function(){this._diaryOpen=!this._diaryOpen;this.renderDiary();var mel=document.getElementById('memorial-section');if(mel)mel.scrollIntoView({behavior:'smooth'})},
_toggleEntry:function(id){this._expanded[id]=!this._expanded[id];this.renderDiary()},

_editEntry:function(id){
  var es=getEntries('me'),e=null;
  for(var i=0;i<es.length;i++){if(es[i].id===id){e=es[i];break}}
  if(!e)return;
  var newText=prompt('编辑日记：',e.text||'');
  if(newText!==null){updateEntry(id,{text:newText},'me');this.renderDiary();showToast('已更新')}
},

_deleteEntry:function(id){
  if(!confirm('确定删除这篇日记？'))return;
  deleteEntry(id,'me');this.renderDiary();showToast('已删除')
},

saveEntry:function(){
  var te=document.getElementById('entry-text');var t=te?te.value.trim():'';
  var dd=Doodle.pendingDoodle||null;
  if(!t&&!dd){showToast('至少写一句话或画一幅涂鸦吧');return}
  var e={id:generateId(),createdAt:new Date().toISOString(),text:t,mood:this.selectedMood,shared:false,doodleDataUrl:dd};
  saveEntry(e,'me');Doodle.clearPending();if(te)te.value='';this.selectedMood='sunny';
  this.renderDiary();showToast('已存入树洞');
},

_toggleShare:function(id){
  var es=getEntries('me'),e=null;
  for(var i=0;i<es.length;i++){if(es[i].id===id){e=es[i];break}}
  if(e){updateEntry(id,{shared:!e.shared},'me');this.renderDiary();
    if(!e.shared&&Sync.roomCode){
      // Send as shared_diary — partner sees a preview card, not the full content inline
      // v113: pass the local diary id so the read receipt can match it back on our side
      Sync.sendSharedDiary(e.text||'',e.doodleDataUrl||null,e.mood,e.id);
      showToast('已分享给TA 📖')
    }else{showToast('已取消分享')}}
},

_showFull:function(src){
  var d=document.createElement('div');d.className='doodle-fullscreen';d.innerHTML='<img src="'+src+'" alt="查看">';
  d.addEventListener('click',function(){d.remove()});document.body.appendChild(d);
},

onDoodleSaved:function(d){Doodle.pendingDoodle=d;showToast('涂鸦已暂存，点击存入树洞保存')},

// ==================== 纪念墙（v114 共享版）====================
// 纪念日 + 愿望清单都是「双方共用一份」，本地存 localStorage，变更通过
// Sync.sendWish / Sync.sendAnniversary 广播；对端在 _poll 里调用
// applyRemoteWish / applyRemoteAnniversary 落到自己的副本。不做已读/提醒。

_annKey:function(){return 'anniversaries_shared'},
_wishKey:function(){return 'wishes_shared'},
_myTag:function(){return '我'},
_taTag:function(){return (typeof Sync!=='undefined'&&Sync.partnerName)?Sync.partnerName:'TA'},

// 读取本地列表（带迁移 + 去重）
_getAnns:function(){
  if(!localStorage.getItem('anns_migrated')){
    try{var old=JSON.parse(localStorage.getItem('anniversaries')||'[]');if(old.length)localStorage.setItem(this._annKey(),JSON.stringify(old));}catch(e){}
    localStorage.setItem('anns_migrated','1');
  }
  try{return JSON.parse(localStorage.getItem(this._annKey())||'[]')}catch(e){return[]}
},
_getWishes:function(){
  if(!localStorage.getItem('wishes_migrated')){
    try{var old=JSON.parse(localStorage.getItem('wishes')||'[]');if(old.length)localStorage.setItem(this._wishKey(),JSON.stringify(old));}catch(e){}
    localStorage.setItem('wishes_migrated','1');
  }
  try{return JSON.parse(localStorage.getItem(this._wishKey())||'[]')}catch(e){return[]}
},
_setAnns:function(a){try{localStorage.setItem(this._annKey(),JSON.stringify(a))}catch(e){}},
_setWishes:function(w){try{localStorage.setItem(this._wishKey(),JSON.stringify(w))}catch(e){}},

// ---------- 纪念日 ----------
_addAnniversary:function(){
  var n=document.getElementById('ann-name'),d=document.getElementById('ann-date'),em=document.getElementById('ann-emoji');
  var name=n?n.value.trim():'',date=d?d.value:'';
  if(!name){showToast('给这个日子起个名字吧');return}
  if(!date){showToast('选一下日期');return}
  var emoji=em&&em.value.trim()?em.value.trim():'💗';
  var id=generateId();
  var rec={id:id,name:name,emoji:emoji,date:date,author:'me',createdAt:new Date().toISOString()};
  var anns=this._getAnns();anns.push(rec);
  anns.sort(function(a,b){return new Date(a.date)-new Date(b.date)});
  this._setAnns(anns);
  if(typeof Sync!=='undefined'&&Sync.roomId&&Sync.partnerId)Sync.sendAnniversary('add',id,name,emoji,date);
  if(n)n.value='';if(d)d.value='';if(em)em.value='';
  this.renderMemorial();showToast('已添加纪念日 🎉');
},
_delAnniversary:function(id){
  if(!confirm('删除这个纪念日？双方都会看不到'))return;
  var anns=this._getAnns(),out=[],found=false;
  for(var i=0;i<anns.length;i++){if(String(anns[i].id)===String(id)){found=true;continue}out.push(anns[i])}
  this._setAnns(out);
  if(found&&typeof Sync!=='undefined'&&Sync.roomId&&Sync.partnerId)Sync.sendAnniversary('del',id);
  this.renderMemorial();showToast('已删除');
},
applyRemoteAnniversary:function(c,senderId){
  if(!c)return;
  var anns=this._getAnns();
  if(c.action==='add'&&c.aid){
    for(var i=0;i<anns.length;i++){if(String(anns[i].id)===String(c.aid))return}
    anns.push({id:c.aid,name:c.name||'',emoji:c.emoji||'💗',date:c.date||'',author:senderId||'ta',createdAt:new Date().toISOString()});
    anns.sort(function(a,b){return new Date(a.date)-new Date(b.date)});
    this._setAnns(anns);this.renderMemorial();
  }else if(c.action==='del'&&c.aid){
    var out=[],hit=false;
    for(var j=0;j<anns.length;j++){if(String(anns[j].id)===String(c.aid)){hit=true;continue}out.push(anns[j])}
    if(hit){this._setAnns(out);this.renderMemorial()}
  }
},

// ---------- 愿望清单 ----------
_migrateWishAuthors:function(){
  var w=this._getWishes(),changed=false;
  for(var i=0;i<w.length;i++){if(!w[i].author){w[i].author='me';changed=true}}
  if(changed)this._setWishes(w);
},
addWish:function(text){
  text=(text||'').trim();
  if(!text){showToast('写下你们想一起做的事');return}
  var id=generateId();
  var rec={id:id,text:text,done:false,author:'me',createdAt:new Date().toISOString()};
  var w=this._getWishes();w.push(rec);this._setWishes(w);
  if(typeof Sync!=='undefined'&&Sync.roomId&&Sync.partnerId)Sync.sendWish('add',id,text,false);
  this.renderMemorial();showToast('已加入愿望清单 ✨');
},
toggleWish:function(id){
  var w=this._getWishes(),hit=false,done=false;
  for(var i=0;i<w.length;i++){if(String(w[i].id)===String(id)){w[i].done=!w[i].done;done=w[i].done;hit=true;break}}
  if(!hit)return;
  this._setWishes(w);
  if(typeof Sync!=='undefined'&&Sync.roomId&&Sync.partnerId)Sync.sendWish('toggle',id,null,done);
  this.renderMemorial();
},
delWish:function(id){
  if(!confirm('删除这条愿望？双方都会看不到'))return;
  var w=this._getWishes(),out=[],hit=false;
  for(var i=0;i<w.length;i++){if(String(w[i].id)===String(id)){hit=true;continue}out.push(w[i])}
  if(!hit)return;
  this._setWishes(out);
  if(typeof Sync!=='undefined'&&Sync.roomId&&Sync.partnerId)Sync.sendWish('del',id);
  this.renderMemorial();showToast('已删除');
},
applyRemoteWish:function(c,senderId){
  if(!c)return;
  var w=this._getWishes();
  if(c.action==='add'&&c.wid){
    for(var i=0;i<w.length;i++){if(String(w[i].id)===String(c.wid))return}
    w.push({id:c.wid,text:c.text||'',done:!!c.done,author:senderId||'ta',createdAt:new Date().toISOString()});
    this._setWishes(w);this.renderMemorial();
  }else if(c.action==='toggle'&&c.wid){
    var hit=false;
    for(var j=0;j<w.length;j++){if(String(w[j].id)===String(c.wid)){w[j].done=!!c.done;hit=true;break}}
    if(hit){this._setWishes(w);this.renderMemorial()}
  }else if(c.action==='del'&&c.wid){
    var out=[],found=false;
    for(var k=0;k<w.length;k++){if(String(w[k].id)===String(c.wid)){found=true;continue}out.push(w[k])}
    if(found){this._setWishes(out);this.renderMemorial()}
  }
},

renderMemorial:function(){
  var el=document.getElementById('memorial-section');if(!el)return;
  el.innerHTML='';
  var self=this;
  var paired=(typeof Sync!=='undefined'&&Sync.partnerId);
  this._migrateWishAuthors();
  var el2=el;
  el2.innerHTML='';

  var card=document.createElement('div');card.className='card';
  card.innerHTML='<div class="card-title">💓 我们的纪念墙</div>';
  if(!paired){
    var hint=document.createElement('p');hint.className='empty-hint';
    hint.textContent='配对之后，这里的东西TA也能看到、也能一起加';
    card.appendChild(hint);
  }

  // ===== 纪念日 =====
  var annWrap=document.createElement('div');annWrap.style.marginBottom='14px';
  var annHeader=document.createElement('div');
  annHeader.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:pointer';
  annHeader.innerHTML='<span style="font-weight:600;font-size:14px">纪念日</span><span class="btn-text" style="font-size:12px">'+(this._annOpen?'收起':'展开')+'</span>';
  annHeader.addEventListener('click',function(){self._annOpen=!self._annOpen;self.renderMemorial()});
  annWrap.appendChild(annHeader);

  if(this._annOpen){
    var anns=this._getAnns();
    // 添加表单
    var form=document.createElement('div');
    form.style.cssText='display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px';
    var ico=document.createElement('input');ico.id='ann-emoji';ico.type='text';ico.value='💗';ico.maxLength=4;
    ico.style.cssText='width:42px;text-align:center;padding:6px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:16px';
    var nm=document.createElement('input');nm.id='ann-name';nm.type='text';nm.placeholder='纪念日名称（如 在一起）';nm.maxLength=20;
    nm.style.cssText='flex:1;min-width:110px;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px';
    var dt=document.createElement('input');dt.id='ann-date';dt.type='date';
    dt.style.cssText='padding:5px 8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px';
    var addBtn=document.createElement('button');addBtn.className='btn-primary';addBtn.textContent='添加';addBtn.style.cssText='padding:6px 14px;font-size:13px';
    addBtn.addEventListener('click',function(){self._addAnniversary()});
    form.appendChild(ico);form.appendChild(nm);form.appendChild(dt);form.appendChild(addBtn);
    annWrap.appendChild(form);

    if(!anns.length){
      var em=document.createElement('p');em.className='empty-hint';em.textContent='还没有纪念日，加上第一个吧';
      annWrap.appendChild(em);
    }else{
      var annList=document.createElement('div');annList.style.cssText='display:flex;gap:10px;overflow-x:auto;padding-bottom:4px';
      anns.forEach(function(a){
        var target=new Date(a.date+'T00:00:00');
        var now=new Date();now.setHours(0,0,0,0);
        var daysDiff=Math.floor((now-target)/86400000);
        // 已过：第N天；未到：倒计时
        var mainLine,subLine;
        if(daysDiff>=0){mainLine='第 '+(daysDiff+1)+' 天';subLine=a.date}
        else{mainLine='还有 '+(-daysDiff)+' 天';subLine=a.date}
        // C6: 若有下一年周期，显示距下次周年
        var nextAnn='';
        if(daysDiff>=0){
          var nd=new Date(target);nd.setFullYear(target.getFullYear());
          while(nd<=now)nd.setFullYear(nd.getFullYear()+1);
          nextAnn=Math.ceil((nd-now)/86400000);
        }
        var item=document.createElement('div');
        item.style.cssText='min-width:118px;background:var(--bg);border-radius:12px;padding:10px;text-align:center;flex-shrink:0;position:relative';
        var authorTag=a.author==='me'?'我':self._taTag();
        item.innerHTML='<div style="font-size:24px">'+escapeHtml(a.emoji||'💗')+'</div>'+
          '<div style="font-size:13px;font-weight:500;margin:4px 0">'+escapeHtml(a.name||'')+'</div>'+
          '<div style="font-size:13px;font-weight:600;color:var(--accent-warm,#F59E0B)">'+mainLine+'</div>'+
          (nextAnn?'<div style="font-size:10px;color:var(--text-dim);margin-top:1px">距周年 '+nextAnn+' 天</div>':'')+
          '<div style="font-size:10px;color:var(--text-dim);margin-top:2px">'+escapeHtml(subLine)+'</div>'+
          '<div style="font-size:9px;color:var(--text-dim);margin-top:2px">'+escapeHtml(authorTag)+'加的</div>'+
          '<button class="btn-text btn-danger" style="font-size:10px;margin-top:4px">删除</button>';
        item.querySelector('button').addEventListener('click',function(){self._delAnniversary(a.id)});
        annList.appendChild(item);
      });
      annWrap.appendChild(annList);
    }
  }
  card.appendChild(annWrap);

  // ===== 愿望清单（共享）=====
  var wishWrap=document.createElement('div');
  var wishHeader=document.createElement('div');
  wishHeader.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:pointer';
  var wishes=this._getWishes();
  var doneCount=0;for(var wi=0;wi<wishes.length;wi++){if(wishes[wi].done)doneCount++}
  wishHeader.innerHTML='<span style="font-weight:600;font-size:14px">一起想做的事'+(wishes.length?' <span style="font-weight:400;font-size:11px;color:var(--text-dim)">'+doneCount+'/'+wishes.length+'</span>':'')+'</span><span class="btn-text" style="font-size:12px">'+(this._wishOpen?'收起':'展开')+'</span>';
  wishHeader.addEventListener('click',function(){self._wishOpen=!self._wishOpen;self.renderMemorial()});
  wishWrap.appendChild(wishHeader);

  if(this._wishOpen){
    // 输入行
    var irow=document.createElement('div');
    irow.style.cssText='display:flex;gap:6px;margin-bottom:10px';
    var win=document.createElement('input');win.id='wish-input';win.type='text';win.maxLength=40;
    win.placeholder='想一起做的事…（如 去看一次海）';
    win.style.cssText='flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px';
    var wbtn=document.createElement('button');wbtn.className='btn-primary';wbtn.textContent='加入';wbtn.style.cssText='padding:6px 14px;font-size:13px';
    function submitWish(){var inp=document.getElementById('wish-input');if(inp){self.addWish(inp.value)}}
    wbtn.addEventListener('click',submitWish);
    win.addEventListener('keydown',function(e){if(e.key==='Enter')submitWish()});
    irow.appendChild(win);irow.appendChild(wbtn);
    wishWrap.appendChild(irow);

    if(!wishes.length){
      var wem=document.createElement('p');wem.className='empty-hint';wem.textContent='还没有愿望，写下你们想一起做的事吧';
      wishWrap.appendChild(wem);
    }else{
      var wishList=document.createElement('div');
      wishes.forEach(function(w){
        var row=document.createElement('div');
        row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)';
        var authorTag=w.author==='me'?'我':self._taTag();
        var authorColor=w.author==='me'?'var(--text-dim)':'var(--accent-warm,#F59E0B)';
        var box=document.createElement('span');box.style.cssText='cursor:pointer;font-size:18px';box.textContent=w.done?'☑':'☐';
        box.addEventListener('click',function(){self.toggleWish(w.id)});
        var tx=document.createElement('span');
        tx.style.cssText='flex:1;font-size:14px;text-decoration:'+(w.done?'line-through':'none')+';color:'+(w.done?'var(--text-dim)':'var(--text)');
        tx.textContent=w.text;
        var tag=document.createElement('span');tag.style.cssText='font-size:10px;color:'+authorColor+';flex-shrink:0';tag.textContent=authorTag;
        var del=document.createElement('button');del.className='btn-text btn-danger';del.style.fontSize='10px';del.textContent='删除';
        del.addEventListener('click',function(){self.delWish(w.id)});
        row.appendChild(box);row.appendChild(tx);row.appendChild(tag);row.appendChild(del);
        wishList.appendChild(row);
      });
      wishWrap.appendChild(wishList);
    }
  }
  card.appendChild(wishWrap);
  el.appendChild(card);
},

renderEntries:function(){this.renderDiary()},
refresh:function(){this.render();this.renderMemorial()}
};
