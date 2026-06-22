var TreeHole={selectedMood:'sunny',pendingDoodle:null,init:function(){this.render()},pickStamp:function(m){this.selectedMood=m;var bs=document.querySelectorAll('#entry-mood-select .mood-stamp-btn');for(var i=0;i<bs.length;i++){bs[i].classList.toggle('selected',bs[i].getAttribute('data-mood')===m)}},

render:function(){this.renderDiary()},

// ===== Diary Section =====
renderDiary:function(){
  var el=document.getElementById('diary-section');if(!el)return;
  var es=getEntries('me');
  var html='<div class="card"><div class="card-title">📖 我的日记</div>';
  html+='<textarea id="entry-text" class="entry-textarea" placeholder="写点什么吧…" rows="3"></textarea>';
  html+='<div class="entry-mood-select" id="entry-mood-select" style="display:flex;gap:6px;margin:8px 0">';
  Object.keys(MOOD_CONFIG).forEach(function(k){html+='<div class="mood-stamp-btn'+(k==='sunny'?' selected':'')+'" data-mood="'+k+'" onclick="TreeHole.pickStamp(\''+k+'\')">'+MOOD_CONFIG[k].icon+'</div>'});
  html+='</div><div style="display:flex;gap:8px"><button class="btn-secondary" onclick="Doodle.open()">🎨 涂鸦</button><button class="btn-primary" onclick="TreeHole.saveEntry()" style="flex:1">存入树洞</button></div></div>';

  // Entries list
  if(!es.length){html+='<p class="empty-hint">还没有日记，写下第一条吧</p>'}
  else{
    var gs=groupByDate(es);
    Object.keys(gs).forEach(function(day){
      html+='<div class="date-group-label">'+day+'</div>';
      gs[day].forEach(function(e){
        var m=MOOD_CONFIG[e.mood]||MOOD_CONFIG.sunny;
        var dateStr=formatMonthDay(e.createdAt);
        html+='<div class="card" style="border-left:3px solid '+m.accent+'"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-weight:500">'+dateStr+' · '+m.icon+' '+m.label+'</span><span style="font-size:11px;color:var(--text-dim)">'+formatTime(e.createdAt)+'</span></div>';
        if(e.text)html+='<div style="font-size:14px;line-height:1.5;white-space:pre-wrap">'+escapeHtml(e.text)+'</div>';
        if(e.doodleDataUrl)html+='<div style="margin-top:8px"><img src="'+e.doodleDataUrl+'" style="max-width:120px;border-radius:8px;cursor:pointer" onclick="TreeHole._showFull(\''+e.doodleDataUrl+'\')"></div>';
        // Share button only when paired
        if(typeof Sync!=='undefined'&&Sync.partnerId){html+='<div style="margin-top:8px;text-align:right"><button class="share-btn'+(e.shared?' shared':'')+'" onclick="TreeHole._toggleShare(\''+e.id+'\')">'+(e.shared?'已分享':'分享给TA')+'</button></div>'}
        html+='</div>';
      });
    });
  }
  el.innerHTML=html;
},

saveEntry:function(){
  var te=document.getElementById('entry-text');var t=te?te.value.trim():'';
  var dd=Doodle.pendingDoodle||null;
  if(!t&&!dd){showToast('至少写一句话或画一幅涂鸦吧');return}
  var e={id:generateId(),createdAt:new Date().toISOString(),text:t,mood:this.selectedMood,shared:false,doodleDataUrl:dd};
  saveEntry(e,'me');Doodle.clearPending();if(te)te.value='';this.selectedMood='sunny';
  this.render();showToast('已存入树洞');
},

_toggleShare:function(id){
  var es=getEntries('me'),e=null;
  for(var i=0;i<es.length;i++){if(es[i].id===id){e=es[i];break}}
  if(e){updateEntry(id,{shared:!e.shared},'me');this.render();
    if(!e.shared&&Sync.roomCode){Sync.sendMessage(e.text,e.doodleDataUrl||null,e.mood);showToast('已分享给TA')}
    else{showToast('已取消分享')}}
},

_showFull:function(src){
  var d=document.createElement('div');d.className='doodle-fullscreen';d.innerHTML='<img src="'+src+'" alt="查看">';
  d.addEventListener('click',function(){d.remove()});document.body.appendChild(d);
},

onDoodleSaved:function(d){Doodle.pendingDoodle=d;showToast('涂鸦已暂存，点击存入树洞保存')},

// ===== Memorial Wall (paired only) =====
renderMemorial:function(){
  var el=document.getElementById('memorial-section');if(!el)return;
  if(typeof Sync==='undefined'||!Sync.partnerId){el.innerHTML='';return}
  var html='<div class="card"><div class="card-title">💝 我们的纪念墙</div>';

  // Anniversaries
  html+='<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-weight:600;font-size:14px">纪念日</span><button class="btn-text" onclick="TreeHole._addAnniversary()">+ 添加</button></div><div id="anniversary-list" style="display:flex;gap:10px;overflow-x:auto;padding-bottom:4px">';
  var anns=JSON.parse(localStorage.getItem('anniversaries')||'[]');
  anns.forEach(function(a,i){
    var days=Math.floor((new Date()-new Date(a.date))/86400000);
    html+='<div style="min-width:120px;background:var(--bg);border-radius:12px;padding:12px;text-align:center;flex-shrink:0"><div style="font-size:24px">'+a.emoji+'</div><div style="font-size:13px;font-weight:500;margin:4px 0">'+escapeHtml(a.name)+'</div><div style="font-size:11px;color:var(--text-dim)">第 '+days+' 天</div><div style="font-size:10px;color:var(--text-dim)">'+a.date+'</div><button class="btn-text btn-danger" style="font-size:10px;margin-top:4px" onclick="TreeHole._delAnniversary('+i+')">删除</button></div>';
  });
  html+='</div></div>';

  // Wish list
  html+='<div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-weight:600;font-size:14px">愿望清单</span><button class="btn-text" onclick="TreeHole._addWish()">+ 添加</button></div><div id="wish-list">';
  var wishes=JSON.parse(localStorage.getItem('wishes')||'[]');
  wishes.forEach(function(w,i){
    html+='<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)"><span style="cursor:pointer;font-size:18px" onclick="TreeHole._toggleWish('+i+')">'+(w.done?'☑':'☐')+'</span><span style="flex:1;font-size:14px;text-decoration:'+(w.done?'line-through':'none')+';color:'+(w.done?'var(--text-dim)':'var(--text)')+'">'+escapeHtml(w.text)+'</span><button class="btn-text btn-danger" style="font-size:10px" onclick="TreeHole._delWish('+i+')">删除</button></div>';
  });
  html+='</div></div></div>';
  el.innerHTML=html;
},

_addAnniversary:function(){
  var name=prompt('纪念日名称：');if(!name||!name.trim())return;
  var emoji=prompt('表情符号：','💗');if(!emoji)return;
  var date=prompt('日期（如 2026-01-01）：');if(!date)return;
  var anns=JSON.parse(localStorage.getItem('anniversaries')||'[]');
  anns.push({name:name.trim(),emoji:emoji,date:date});anns.sort(function(a,b){return new Date(a.date)-new Date(b.date)});
  localStorage.setItem('anniversaries',JSON.stringify(anns));this.renderMemorial();
},
_delAnniversary:function(i){var anns=JSON.parse(localStorage.getItem('anniversaries')||'[]');anns.splice(i,1);localStorage.setItem('anniversaries',JSON.stringify(anns));this.renderMemorial()},
_addWish:function(){var t=prompt('愿望：');if(!t||!t.trim())return;var wishes=JSON.parse(localStorage.getItem('wishes')||'[]');wishes.push({text:t.trim(),done:false});localStorage.setItem('wishes',JSON.stringify(wishes));this.renderMemorial()},
_toggleWish:function(i){var wishes=JSON.parse(localStorage.getItem('wishes')||'[]');if(wishes[i]){wishes[i].done=!wishes[i].done;localStorage.setItem('wishes',JSON.stringify(wishes));this.renderMemorial()}},
_delWish:function(i){var wishes=JSON.parse(localStorage.getItem('wishes')||'[]');wishes.splice(i,1);localStorage.setItem('wishes',JSON.stringify(wishes));this.renderMemorial()},

renderEntries:function(){this.renderDiary()}, // legacy
refresh:function(){this.render();this.renderMemorial()}
};
