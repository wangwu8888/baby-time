var TreeHole={selectedMood:'sunny',pendingDoodle:null,_diaryOpen:true,_annOpen:true,_wishOpen:true,init:function(){this.render()},pickStamp:function(m){this.selectedMood=m;var bs=document.querySelectorAll('#entry-mood-select .mood-stamp-btn');for(var i=0;i<bs.length;i++){bs[i].classList.toggle('selected',bs[i].getAttribute('data-mood')===m)}},

render:function(){this.renderDiary()},

renderDiary:function(){
  var el=document.getElementById('diary-section');if(!el)return;
  var es=getEntries('me');
  var self=this;
  var html='<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="TreeHole._toggleDiary()"><div class="card-title" style="margin:0">📖 我的日记</div><span id="diary-toggle" style="font-size:18px">'+(this._diaryOpen?'▼':'▶')+'</span></div>';
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
        html+='<div class="card" style="border-left:3px solid '+m.accent+'"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-weight:500">'+formatMonthDay(e.createdAt)+' · '+m.icon+' '+m.label+'</span><span style="font-size:11px;color:var(--text-dim)">'+formatTime(e.createdAt)+'</span></div>';
        if(e.text)html+='<div style="font-size:14px;line-height:1.5;white-space:pre-wrap" id="diary-text-'+e.id+'">'+escapeHtml(e.text)+'</div>';
        if(e.doodleDataUrl)html+='<div style="margin-top:8px"><img src="'+e.doodleDataUrl+'" style="max-width:120px;border-radius:8px;cursor:pointer" onclick="TreeHole._showFull(\''+e.doodleDataUrl+'\')"></div>';
        html+='<div style="margin-top:8px;display:flex;gap:6px;justify-content:flex-end">';
        html+='<button class="btn-text" style="font-size:11px" onclick="TreeHole._editEntry(\''+e.id+'\')">✏️ 编辑</button>';
        html+='<button class="btn-text btn-danger" style="font-size:11px" onclick="TreeHole._deleteEntry(\''+e.id+'\')">🗑️ 删除</button>';
        if(typeof Sync!=='undefined'&&Sync.partnerId){html+='<button class="share-btn'+(e.shared?' shared':'')+'" style="font-size:11px" onclick="TreeHole._toggleShare(\''+e.id+'\')">'+(e.shared?'已分享':'分享给TA')+'</button>'}
        html+='</div></div>';
      });
    });
  }
  html+='</div></div>';
  el.innerHTML=html;
},

_toggleDiary:function(){this._diaryOpen=!this._diaryOpen;this.renderDiary();var mel=document.getElementById('memorial-section');if(mel)mel.scrollIntoView({behavior:'smooth'})},

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
      Sync.sendSharedDiary(e.text||'',e.doodleDataUrl||null,e.mood);
      showToast('已分享给TA 📖')
    }else{showToast('已取消分享')}}
},

_showFull:function(src){
  var d=document.createElement('div');d.className='doodle-fullscreen';d.innerHTML='<img src="'+src+'" alt="查看">';
  d.addEventListener('click',function(){d.remove()});document.body.appendChild(d);
},

onDoodleSaved:function(d){Doodle.pendingDoodle=d;showToast('涂鸦已暂存，点击存入树洞保存')},

renderMemorial:function(){
  var el=document.getElementById('memorial-section');if(!el)return;
  if(typeof Sync==='undefined'||!Sync.partnerId){el.innerHTML='';return}
  var self=this;
  el.innerHTML='';
  var card=document.createElement('div');card.className='card';
  card.innerHTML='<div class="card-title">💝 我们的纪念墙</div>';

  // Anniversaries
  var annWrap=document.createElement('div');annWrap.style.marginBottom='12px';
  var annHeader=document.createElement('div');annHeader.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:pointer';
  annHeader.innerHTML='<span style="font-weight:600;font-size:14px">'+(this._annOpen?'▼':'▶')+' 纪念日</span><button class="btn-text">+ 添加</button>';
  annHeader.querySelector('button').addEventListener('click',function(e){e.stopPropagation();self._addAnniversary()});
  annHeader.addEventListener('click',function(){self._annOpen=!self._annOpen;self.renderMemorial()});
  annWrap.appendChild(annHeader);
  if(this._annOpen){
    var annList=document.createElement('div');annList.style.cssText='display:flex;gap:10px;overflow-x:auto;padding-bottom:4px';
    var anns=JSON.parse(localStorage.getItem('anniversaries')||'[]');
    anns.forEach(function(a,i){
      var days=Math.floor((new Date()-new Date(a.date))/86400000);
      var item=document.createElement('div');item.style.cssText='min-width:120px;background:var(--bg);border-radius:12px;padding:12px;text-align:center;flex-shrink:0';
      item.innerHTML='<div style="font-size:24px">'+a.emoji+'</div><div style="font-size:13px;font-weight:500;margin:4px 0">'+escapeHtml(a.name)+'</div><div style="font-size:11px;color:var(--text-dim)">第 '+days+' 天</div><div style="font-size:10px;color:var(--text-dim)">'+a.date+'</div><button class="btn-text btn-danger" style="font-size:10px;margin-top:4px">删除</button>';
      item.querySelector('button').addEventListener('click',function(){self._delAnniversary(i)});
      annList.appendChild(item);
    });
    annWrap.appendChild(annList);
  }
  card.appendChild(annWrap);

  // Wishes
  var wishWrap=document.createElement('div');
  var wishHeader=document.createElement('div');wishHeader.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:pointer';
  wishHeader.innerHTML='<span style="font-weight:600;font-size:14px">'+(this._wishOpen?'▼':'▶')+' 愿望清单</span><button class="btn-text">+ 添加</button>';
  wishHeader.querySelector('button').addEventListener('click',function(e){e.stopPropagation();self._addWish()});
  wishHeader.addEventListener('click',function(){self._wishOpen=!self._wishOpen;self.renderMemorial()});
  wishWrap.appendChild(wishHeader);
  if(this._wishOpen){
    var wishList=document.createElement('div');
    var wishes=JSON.parse(localStorage.getItem('wishes')||'[]');
    wishes.forEach(function(w,i){
      var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)';
      row.innerHTML='<span style="cursor:pointer;font-size:18px">'+(w.done?'☑':'☐')+'</span><span style="flex:1;font-size:14px;text-decoration:'+(w.done?'line-through':'none')+';color:'+(w.done?'var(--text-dim)':'var(--text)')+'">'+escapeHtml(w.text)+'</span><button class="btn-text btn-danger" style="font-size:10px">删除</button>';
      row.querySelector('span').addEventListener('click',function(){self._toggleWish(i)});
      row.querySelector('button').addEventListener('click',function(){self._delWish(i)});
      wishList.appendChild(row);
    });
    wishWrap.appendChild(wishList);
  }
  card.appendChild(wishWrap);
  el.appendChild(card);
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

renderEntries:function(){this.renderDiary()},
refresh:function(){this.render();this.renderMemorial()}
};
