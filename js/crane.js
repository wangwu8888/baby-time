// Paper crane jar — "thinking of you" counter
var Crane = {
  _myCount: 0,
  _taCount: 0,
  _total: 0,

  init: function() {
    var paired = !!Sync.partnerId;
    if (!paired) { this._hide(); return; }
    this._loadCounts();
    this.render();
  },

  _loadCounts: function() {
    try {
      this._myCount = parseInt(localStorage.getItem('crane_my_count') || '0');
      this._taCount = parseInt(localStorage.getItem('crane_ta_count') || '0');
    } catch(e) { this._myCount = 0; this._taCount = 0; }
    this._total = this._myCount + this._taCount;
  },

  _saveCounts: function() {
    try {
      localStorage.setItem('crane_my_count', this._myCount);
      localStorage.setItem('crane_ta_count', this._taCount);
    } catch(e) {}
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
    var jarHeight = Math.min(120, 30 + this._total * 4);
    var craneDisplay = this._total > 0 ? this._total + '' : '';

    // Build crane emojis to fill the jar
    var emojis = '';
    var count = Math.min(this._total, 30);
    for (var i = 0; i < count; i++) {
      emojis += '<span style="position:absolute;font-size:16px;left:'+(5+Math.random()*80)+'%;top:'+(5+Math.random()*85)+'%;transform:rotate('+((Math.random()-0.5)*40)+'deg)">🕊️</span>';
    }

    el.innerHTML =
      '<div class="card-title">🫙 许愿瓶</div>' +
      '<div style="display:flex;align-items:center;gap:12px">' +
      // Jar visualization
      '<div style="position:relative;width:90px;height:'+jarHeight+'px;background:rgba(255,255,255,0.3);border:2px solid rgba(180,200,220,0.5);border-radius:12px 12px 16px 16px;overflow:hidden;flex-shrink:0">' +
      '<div style="position:absolute;top:-2px;left:20%;width:60%;height:8px;background:rgba(180,200,220,0.4);border-radius:0 0 6px 6px"></div>' +
      emojis +
      (this._total > 0 ? '<div style="position:absolute;bottom:4px;width:100%;text-align:center;font-size:11px;color:var(--accent-warm);font-weight:600;text-shadow:0 1px 2px rgba(255,255,255,0.8)">'+craneDisplay+'</div>' : '') +
      '</div>' +
      // Info + buttons
      '<div style="flex:1;display:flex;flex-direction:column;gap:6px">' +
      '<div style="font-size:13px;color:var(--text)">我折了 <b style="color:var(--accent-warm)">'+this._myCount+'</b> 只 · TA折了 <b style="color:var(--accent-blue)">'+this._taCount+'</b> 只</div>' +
      '<div style="display:flex;gap:6px">' +
      '<button class="btn-primary" onclick="Crane.addOne()" style="font-size:13px;padding:6px 14px;border-radius:20px">🕊️ 想你了</button>' +
      (this._myCount > 0 ? '<button class="btn-text btn-danger" onclick="Crane.clearAll()" style="font-size:11px">清空</button>' : '') +
      '</div></div></div>';
  },

  addOne: function() {
    if (!Sync.roomCode) return;
    this._myCount++;
    this._saveCounts();
    this.render();
    this._flyIn();
    // Send crane to partner
    Sync.sendCrane();
  },

  clearAll: function() {
    if (!confirm('清空所有纸鹤？TA的纸鹤也会一起飞走哦')) return;
    this._myCount = 0;
    this._taCount = 0;
    this._saveCounts();
    this.render();
    this._flyOut();
    Sync.clearCranes();
  },

  // Receive from partner
  onTaCrane: function() {
    this._taCount++;
    this._saveCounts();
    this.render();
    this._flyIn();
    showToast('🕊️ TA想你了', 2000);
  },

  onTaClear: function() {
    this._myCount = 0;
    this._taCount = 0;
    this._saveCounts();
    this.render();
    this._flyOut();
  },

  _flyIn: function() {
    var crane = document.createElement('div');
    crane.textContent = '🕊️';
    crane.style.cssText = 'position:fixed;z-index:400;font-size:24px;bottom:-30px;right:30px;transition:all 0.8s cubic-bezier(0.25,0.46,0.45,0.94);pointer-events:none';
    document.body.appendChild(crane);
    requestAnimationFrame(function() {
      crane.style.bottom = '60%';
      crane.style.right = '40px';
      crane.style.transform = 'rotate(-20deg) scale(0.6)';
      crane.style.opacity = '0.8';
    });
    setTimeout(function() { crane.style.opacity = '0'; setTimeout(function() { crane.remove(); }, 300); }, 700);
  },

  _flyOut: function() {
    var count = Math.min(this._total || 10, 20);
    for (var i = 0; i < count; i++) {
      setTimeout((function(idx) { return function() {
        var crane = document.createElement('div');
        crane.textContent = '🕊️';
        crane.style.cssText = 'position:fixed;z-index:400;font-size:20px;bottom:50%;right:40px;transition:all 1s ease-in;pointer-events:none';
        document.body.appendChild(crane);
        requestAnimationFrame(function() {
          crane.style.bottom = '110%';
          crane.style.right = (20 + Math.random() * 200) + 'px';
          crane.style.transform = 'rotate('+((Math.random()-0.5)*80)+'deg)';
          crane.style.opacity = '0';
        });
        setTimeout(function() { crane.remove(); }, 1000);
      } })(i), i * 50);
    }
  }
};
