// 思念瓶 — longing bottle with random keepsakes
var Crane = {
  _myCount: 0,
  _taCount: 0,
  _total: 0,
  _icons: [
    { emoji:'🕊️', label:'纸鹤', weight:35, size:30 },
    { emoji:'🪶', label:'羽毛', weight:25, size:26 },
    { emoji:'🌟', label:'流星', weight:20, size:32 },
    { emoji:'✨', label:'星光', weight:20, size:24 }
  ],

  init: function() {
    if (!Sync.partnerId) { this._hide(); return; }
    this._loadCounts();
    this.render();
  },

  _pickIcon: function() {
    var r = Math.random() * 100;
    var acc = 0;
    for (var i = 0; i < this._icons.length; i++) {
      acc += this._icons[i].weight;
      if (r <= acc) return this._icons[i];
    }
    return this._icons[0];
  },

  _loadCounts: function() {
    try {
      this._myCount = parseInt(localStorage.getItem('crane_my_count') || '0');
      this._taCount = parseInt(localStorage.getItem('crane_ta_count') || '0');
    } catch(e) { this._myCount = 0; this._taCount = 0; }
    this._total = this._myCount + this._taCount;
  },

  _saveCounts: function() {
    try { localStorage.setItem('crane_my_count', this._myCount); localStorage.setItem('crane_ta_count', this._taCount); } catch(e) {}
  },

  _hide: function() {
    var el = document.getElementById('crane-jar-card');
    if (el) el.style.display = 'none';
  },

  render: function() {
    var el = document.getElementById('crane-jar-card');
    if (!el) return;
    el.style.display = '';
    this._total = this._myCount + this._taCount;
    var jarH = Math.max(100, Math.min(160, 80 + this._total * 2));

    // Build jar contents — show up to 40 visible icons
    var items = '';
    var showCount = Math.min(this._total, 40);
    for (var i = 0; i < showCount; i++) {
      var seed = (i * 137 + 53) % 100; // deterministic pseudo-random
      var iconIdx = i % 4;
      var icon = this._icons[iconIdx];
      items += '<span style="position:absolute;font-size:'+icon.size+'px;left:'+(4+(seed%88))+'%;top:'+(4+(i*7)%85)+'%;transform:rotate('+((seed-50)*0.6)+'deg);opacity:0.85;transition:all 0.3s;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.1))">'+icon.emoji+'</span>';
    }

    el.innerHTML =
      '<div style="background:linear-gradient(135deg,#fdf2f8,#f5f3ff,#ede9fe);border-radius:var(--radius);padding:14px 16px">' +
      '<div class="card-title" style="margin-bottom:10px">💝 思念瓶</div>' +
      '<div style="display:flex;align-items:center;gap:14px">' +
      // Glass jar
      '<div id="crane-jar" style="position:relative;width:100px;height:'+jarH+'px;background:linear-gradient(135deg,rgba(255,255,255,0.5),rgba(255,255,255,0.2));border:2px solid rgba(200,180,220,0.5);border-radius:16px 16px 20px 20px;overflow:hidden;flex-shrink:0;cursor:pointer;box-shadow:inset 0 2px 12px rgba(255,255,255,0.3),0 4px 16px rgba(180,160,200,0.2);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)" onclick="Crane.addOne()" title="点击添加思念">' +
      '<div style="position:absolute;top:-2px;left:18%;width:64%;height:10px;background:linear-gradient(180deg,rgba(200,180,220,0.5),rgba(220,210,240,0.3));border-radius:0 0 8px 8px;z-index:2"></div>' +
      '<div style="position:absolute;left:6px;top:15%;width:3px;height:30%;background:rgba(255,255,255,0.5);border-radius:2px"></div>' +
      '<div id="crane-items" style="position:absolute;inset:12px 4px 4px 4px">'+items+'</div>' +
      (this._total > 0 ? '<div style="position:absolute;bottom:4px;width:100%;text-align:center;font-size:12px;color:var(--accent-warm);font-weight:700;z-index:2;text-shadow:0 1px 3px rgba(255,255,255,0.9)">'+this._total+'</div>' : '') +
      '</div>' +
      // Info + buttons
      '<div style="flex:1;display:flex;flex-direction:column;gap:8px">' +
      '<div style="font-size:13px;line-height:1.5;color:var(--text)">我 <b style="color:var(--accent-warm)">'+this._myCount+'</b> · TA <b style="color:var(--accent-blue)">'+this._taCount+'</b></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button class="btn-primary" onclick="Crane.addOne();event.stopPropagation()" style="font-size:13px;padding:7px 16px;border-radius:20px;background:linear-gradient(135deg,#e8a0c0,#d4a0d4)">💌 想你了</button>' +
      (this._myCount > 0 ? '<button class="btn-text btn-danger" onclick="Crane.clearAll();event.stopPropagation()" style="font-size:11px">清空</button>' : '') +
      '</div></div></div></div>';

    // Keyboard shortcut
    var self = this;
    document.addEventListener('keydown', function(e) {
      if (e.code === 'Space' && document.activeElement === document.body && Sync.partnerId) {
        e.preventDefault(); self.addOne();
      }
    });
  },

  addOne: function() {
    if (!Sync.roomCode) return;
    var icon = this._pickIcon();
    this._myCount++;
    this._total = this._myCount + this._taCount;
    this._saveCounts();
    this.render();
    this._flyIn(icon);
    Sync.sendCrane();
    // Check milestone
    if (this._total === 99) this._milestone();
  },

  clearAll: function() {
    if (!confirm('清空所有思念信物？TA的信物也会一起飞走哦')) return;
    var total = this._total;
    this._myCount = 0;
    this._taCount = 0;
    this._total = 0;
    this._saveCounts();
    this.render();
    this._flyOut(total);
    Sync.clearCranes();
  },

  onTaCrane: function() {
    this._taCount++;
    this._total = this._myCount + this._taCount;
    this._saveCounts();
    this.render();
    this._flyIn(this._pickIcon());
    showToast('💌 TA想你了', 2000);
    if (this._total === 99) this._milestone();
  },

  onTaClear: function() {
    this._myCount = 0;
    this._taCount = 0;
    this._total = 0;
    this._saveCounts();
    this.render();
  },

  _flyIn: function(icon) {
    var el = document.createElement('div');
    el.textContent = icon.emoji;
    el.style.cssText = 'position:fixed;z-index:500;font-size:'+icon.size+'px;bottom:-40px;right:'+(20+Math.random()*60)+'px;transition:all 0.7s cubic-bezier(0.34,1.56,0.64,1);pointer-events:none;filter:drop-shadow(0 2px 6px rgba(180,140,200,0.4))';
    document.body.appendChild(el);
    requestAnimationFrame(function() {
      el.style.bottom = (40 + Math.random() * 30) + '%';
      el.style.right = (10 + Math.random() * 30) + 'px';
      el.style.transform = 'rotate('+((Math.random()-0.5)*60)+'deg) scale(0.7)';
      el.style.opacity = '0.9';
    });
    setTimeout(function() { el.style.opacity = '0'; setTimeout(function() { el.remove(); }, 300); }, 650);
  },

  _flyOut: function(count) {
    var items = this._icons;
    var n = Math.min(count || 10, 30);
    for (var i = 0; i < n; i++) {
      setTimeout((function(idx) { return function() {
        var icon = items[idx % 4];
        var el = document.createElement('div');
        el.textContent = icon.emoji;
        el.style.cssText = 'position:fixed;z-index:500;font-size:'+icon.size+'px;bottom:45%;right:'+(20+Math.random()*40)+'px;transition:all 0.9s ease-in;pointer-events:none;filter:drop-shadow(0 2px 6px rgba(180,140,200,0.4))';
        document.body.appendChild(el);
        requestAnimationFrame(function() {
          el.style.bottom = (100 + Math.random() * 40) + '%';
          el.style.right = (-20 + Math.random() * 120) + 'px';
          el.style.transform = 'rotate('+((Math.random()-0.5)*120)+'deg) scale(0.5)';
          el.style.opacity = '0';
        });
        setTimeout(function() { el.remove(); }, 900);
      } })(i), i * 60);
    }
  },

  _milestone: function() {
    var jar = document.getElementById('crane-jar');
    if (!jar) return;
    // Golden glow
    jar.style.transition = 'box-shadow 0.5s';
    jar.style.boxShadow = '0 0 30px rgba(255,215,0,0.6), 0 0 60px rgba(255,215,0,0.4), 0 0 90px rgba(255,180,0,0.2), inset 0 2px 12px rgba(255,255,255,0.3)';
    setTimeout(function() { jar.style.boxShadow = 'inset 0 2px 12px rgba(255,255,255,0.3), 0 4px 16px rgba(180,160,200,0.2)'; }, 3000);

    // Spiral particles around jar
    var jarRect = jar.getBoundingClientRect();
    var cx = jarRect.left + jarRect.width / 2;
    var cy = jarRect.top + jarRect.height / 2;
    var icons = this._icons;
    for (var i = 0; i < 16; i++) {
      setTimeout((function(idx) { return function() {
        var angle = (idx / 16) * Math.PI * 2;
        var r = 70 + idx * 3;
        var icon = icons[idx % 4];
        var p = document.createElement('div');
        p.textContent = icon.emoji;
        p.style.cssText = 'position:fixed;z-index:600;font-size:'+(icon.size-4)+'px;left:'+(cx+r*Math.cos(angle)-15)+'px;top:'+(cy+r*Math.sin(angle)-15)+'px;transition:all 2.5s ease-out;pointer-events:none;filter:drop-shadow(0 0 8px rgba(255,215,0,0.6))';
        document.body.appendChild(p);
        requestAnimationFrame(function() {
          p.style.left = (cx + (r+40) * Math.cos(angle + Math.PI * 0.7)) + 'px';
          p.style.top = (cy + (r+40) * Math.sin(angle + Math.PI * 0.7)) + 'px';
          p.style.opacity = '0';
          p.style.transform = 'scale(1.8)';
        });
        setTimeout(function() { p.remove(); }, 2500);
      } })(i), i * 100);
    }

    // Falling petals
    for (var j = 0; j < 20; j++) {
      setTimeout(function() {
        var petal = document.createElement('div');
        petal.textContent = ['🌸','💮','✿','🌷'][Math.floor(Math.random()*4)];
        petal.style.cssText = 'position:fixed;z-index:599;font-size:'+(16+Math.random()*12)+'px;left:'+(Math.random()*95)+'%;top:-30px;transition:all '+(2+Math.random()*3)+'s ease-in;pointer-events:none;filter:drop-shadow(0 0 6px rgba(255,200,220,0.5))';
        document.body.appendChild(petal);
        requestAnimationFrame(function() {
          petal.style.top = '105%';
          petal.style.left = (parseFloat(petal.style.left) + (Math.random()-0.5)*30) + '%';
          petal.style.transform = 'rotate('+(Math.random()*360)+'deg)';
          petal.style.opacity = '0.6';
        });
        setTimeout(function() { petal.remove(); }, 4000);
      }, j * 150);
    }
  }
};
