// ==================== 每日一题（v120 密信盲盒风） ====================
// 双方每天看到的是同一道题——不需要商量，靠「日期哈希」各自算出同一个下标。
// 答案复用 messages 表（type='daily_q'），已经上了 RLS，只有房间成员能读，不用新建表。
//
// 交互：卡片 = 一封今天的密信。问题被色块盖住，轻触「刮开」才浮现；
//       写回信走底部弹窗，封存后主卡片留一张清爽的回执（不再有常驻输入框和大按钮）。
//
// 题库：改这个数组即可换题（注意两端版本要一致，否则同一天可能算出不同的题）。
var DAILY_QUESTIONS = [
  ['关于我们', '你还记得第一次见我时，我穿的是什么颜色的衣服吗？'],
  ['关于我们', '如果只能用三个词形容我，你会选哪三个？'],
  ['关于我们', '你觉得我们俩谁更会说情话？'],
  ['关于我们', '我们之间最默契的一次是什么时候？'],
  ['关于我们', '你觉得我最可爱的小毛病是什么？'],
  ['关于我们', '如果给我们的关系起一个电影名字，会叫什么？'],
  ['关于我们', '你觉得我们在哪方面特别像？'],
  ['关于我们', '我做过的哪件小事让你偷偷感动过？'],
  ['关于我们', '你第一次觉得「就是这个人了」是什么时候？'],
  ['关于我们', '如果我只剩一个优点，你希望是哪个？'],
  ['回忆', '你最想重温我们的哪一天？'],
  ['回忆', '我们第一次一起吃饭，你点了什么？'],
  ['回忆', '你手机里最舍不得删的、关于我的照片是哪张？'],
  ['回忆', '我们吵过的架里，哪一次现在想起来觉得好笑？'],
  ['回忆', '你第一次牵我手的时候在想什么？'],
  ['回忆', '我们一起看过的天气里，你最喜欢哪一种？'],
  ['回忆', '哪一句我说过的话，你到现在还记得？'],
  ['回忆', '我们之间最浪漫的一个瞬间是什么？'],
  ['回忆', '你第一次在我面前哭（或者差点哭）是因为什么？'],
  ['回忆', '我们视频最久的一次聊了什么？'],
  ['未来', '明年这个时候，你希望我们在做什么？'],
  ['未来', '如果明年能一起去一个地方，你想去哪儿？'],
  ['未来', '以后我们的家，你最先想买的一件家具是什么？'],
  ['未来', '你希望十年后的我们，一天是怎么过的？'],
  ['未来', '你想和我一起学一件什么事？'],
  ['未来', '如果我们可以养一只宠物，你选猫还是狗，叫什么名字？'],
  ['未来', '你最想和我一起看的一场演出是什么？'],
  ['未来', '如果有一次说走就走的旅行，你的第一反应去哪？'],
  ['未来', '你希望我们老了以后住在什么样的地方？'],
  ['未来', '你偷偷想过我们婚礼（或者纪念日）的样子吗？'],
  ['心里话', '今天有什么想跟我说、但没说出口的？'],
  ['心里话', '最近有什么事让你压力很大？'],
  ['心里话', '你希望我多做什么、少做什么？'],
  ['心里话', '你最近一次觉得孤单是什么时候？'],
  ['心里话', '你觉得我现在最需要知道你的哪件事？'],
  ['心里话', '有什么事你一直想问我又没问的？'],
  ['心里话', '你希望我在你难过的时候怎么做？'],
  ['心里话', '最近有没有我说的话让你不太舒服？'],
  ['心里话', '你现在最想要的一个安慰是什么样子的？'],
  ['心里话', '如果今天可以许一个和我有关的愿，你许什么？'],
  ['小趣味', '如果变成一种天气，你今天是哪种？'],
  ['小趣味', '今天你的电量剩多少？（0-100）'],
  ['小趣味', '今天最想吃的三样东西是什么？'],
  ['小趣味', '如果今天可以不上班，你会干什么？'],
  ['小趣味', '最近循环播放的是哪首歌？'],
  ['小趣味', '如果你是一件物品，今天你会是什么？'],
  ['小趣味', '今天有什么让你笑出来的小事？'],
  ['小趣味', '如果现在能瞬移，你最想去哪儿待一小时？'],
  ['小趣味', '今天你给自己打几分？为什么？'],
  ['小趣味', '你最近迷上了什么？'],
  ['甜一点', '今天最想对我说的一句话是什么？'],
  ['甜一点', '说一件你感谢我的事。'],
  ['甜一点', '你最喜欢我身体的哪个部分？'],
  ['甜一点', '你觉得我最迷人的瞬间是什么时候？'],
  ['甜一点', '如果我是一道菜，我是什么？为什么？'],
  ['甜一点', '你想被我怎样称呼？'],
  ['甜一点', '今天想跟我要一个什么样的抱抱？'],
  ['甜一点', '你最喜欢我对你说哪句话？'],
  ['甜一点', '如果要给我写一首歌的开头一句，你会写什么？'],
  ['甜一点', '你觉得我们之间最甜的小习惯是什么？'],
  ['深一点', '你觉得爱一个人最难的部分是什么？'],
  ['深一点', '你害怕失去我的什么？'],
  ['深一点', '你觉得我们之间最大的功课是什么？'],
  ['深一点', '什么时候你觉得自己最像自己？'],
  ['深一点', '你希望我在你的人生里扮演什么样的角色？'],
  ['深一点', '如果有一样东西你想让我永远不要改，那是什么？'],
  ['深一点', '你怎么定义「被爱着」？'],
  ['深一点', '你觉得我们要一起面对的最大的挑战会是什么？'],
  ['深一点', '有哪件事你原谅了我，但一直没告诉我？'],
  ['深一点', '你希望我们十年后还能保留现在的哪个习惯？'],
  ['日常', '今天吃了什么？好吃吗？'],
  ['日常', '今天睡得好吗？做了梦吗？'],
  ['日常', '现在窗外是什么天气？拍给我看看。'],
  ['日常', '今天你最累的一刻是什么时候？'],
  ['日常', '今天有什么想吐槽的？'],
  ['日常', '今天有没有按时喝水？'],
  ['日常', '今天最想被表扬的一件事是什么？'],
  ['日常', '明天有什么安排？要我叫你起床吗？'],
  ['日常', '今天通勤路上在想什么？'],
  ['日常', '此刻你身边有什么声音？'],
  ['假设题', '如果能回到过去改变一件事，但代价是不认识我，你改吗？'],
  ['假设题', '如果世界明天结束，今晚你想怎么过？'],
  ['假设题', '如果我们互换一天身体，你最想体验什么？'],
  ['假设题', '如果只能保留一段关于我的记忆，你留哪段？'],
  ['假设题', '如果有一个只能问我一个问题的机会，你问什么？'],
  ['假设题', '如果我们的故事要拍成短片，最后一幕是什么？'],
  ['假设题', '如果你能听到我心里的一句话，你希望听到什么？'],
  ['假设题', '如果能给我一个超能力，你给什么？'],
  ['假设题', '如果明天醒来你在另一个城市，第一个想打给谁？'],
  ['假设题', '如果爱有重量，你觉得我们现在有多重？']
];

var Daily = {
  KEY: 'daily_answers',

  // 远端「双方各写过哪几天」的日期集合（由 sync 每次拉消息时喂进来）。
  // 只用来算默契值，不参与题目展示 —— 本地记录被清掉时也能把默契值补回来。
  _remote: { mine: {}, ta: {} },
  _remoteFp: '',

  // ---------- 日期与选题 ----------
  _key: function(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  _hashKey: function(k) {
    var n = 0;
    for (var i = 0; i < k.length; i++) { n = (n * 31 + k.charCodeAt(i)) >>> 0; }
    return n;
  },
  _idxFor: function(k) { return this._hashKey(k) % DAILY_QUESTIONS.length; },
  _qFor: function(k) { return DAILY_QUESTIONS[this._idxFor(k)]; },

  // ---------- 本地数据 ----------
  _all: function() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '{}') || {}; } catch (e) { return {}; }
  },
  _setAll: function(m) { try { localStorage.setItem(this.KEY, JSON.stringify(m)); } catch (e) {} },
  _day: function(k) {
    var m = this._all();
    if (!m[k]) {
      var q = this._qFor(k);
      m[k] = { idx: this._idxFor(k), q: q[1], cat: q[0], mine: null, ta: null, opened: false, draft: '' };
      this._setAll(m);
    }
    return m[k];
  },
  _save: function(k, rec) { var m = this._all(); m[k] = rec; this._setAll(m); },

  // ---------- 拆信：色块渐隐，露出今天的问题 ----------
  // 拆过一次就记进 opened，之后刷新/重进都直接显示问题，不再重复刮。
  _opening: false,
  reveal: function() {
    var self = this, k = this._key(), rec = this._day(k);
    if (rec.opened || this._opening) return;          // 已拆开 / 正在拆，防连点
    var el = document.getElementById('dc-scratch');
    var finish = function() {
      self._opening = false;
      var r = self._day(k); r.opened = true; self._save(k, r); self.render();
    };
    if (!el) { finish(); return; }                    // 找不到节点也要让状态生效
    this._opening = true;
    el.classList.add('dc-opening');                   // 300ms 渐隐，与 CSS 时长一致
    setTimeout(finish, 300);
  },

  // ---------- 写信：底部弹窗 ----------
  openSheet: function() {
    var rec = this._day(this._key());
    var sh = document.getElementById('daily-sheet');
    if (!sh) return;
    var q = document.getElementById('ds-question');
    if (q) q.textContent = rec.q || '';
    var ta = document.getElementById('ds-text');
    if (ta) ta.value = (rec.mine && rec.mine.text) || rec.draft || '';
    sh.classList.remove('hidden');
    // 等入场动效走完再聚焦，手机键盘才会跟着弹出来
    setTimeout(function() {
      var t = document.getElementById('ds-text');
      if (!t) return;
      try { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } catch (e) {}
    }, 320);
  },

  // keepDraft 为 false 表示「封存后关闭」，否则把草稿留着，下次点开还在
  closeSheet: function(keepDraft) {
    if (keepDraft !== false) {
      var ta = document.getElementById('ds-text');
      if (ta) { var k = this._key(), r = this._day(k); r.draft = ta.value || ''; this._save(k, r); }
    }
    var sh = document.getElementById('daily-sheet');
    if (sh) sh.classList.add('hidden');
  },

  seal: function() {
    var ta = document.getElementById('ds-text');
    var text = ta ? (ta.value || '').trim() : '';
    if (!text) { showToast('写点什么再封存吧'); return; }
    if (typeof Sync === 'undefined' || !Sync.roomId || !Sync.partnerId) { showToast('先和 TA 连接上再写信吧'); return; }
    var k = this._key(), rec = this._day(k);
    rec.mine = { text: text, at: new Date().toISOString() };
    rec.opened = true;
    rec.draft = '';
    this._save(k, rec);
    Sync.sendDailyAnswer(k, rec.idx, rec.q, text);
    this.closeSheet(false);
    this.render();
    showToast('已封存，等 TA 拆开 💌');
  },

  // 兼容旧调用：answer('文字')
  answer: function(text) {
    var ta = document.getElementById('ds-text');
    if (text !== undefined && ta) ta.value = text;
    this.seal();
  },

  // ---------- 收到 TA 的答案 ----------
  applyRemote: function(c, senderId) {
    if (!c || !c.date || !c.text) return;
    var m = this._all();
    var rec = m[c.date];
    if (!rec) { rec = { idx: c.idx, q: c.q || '', cat: c.cat || '', mine: null, ta: null, opened: false, draft: '' }; }
    // 版本不一致时，以 TA 带过来的题目为准展示
    if (typeof c.idx === 'number' && rec.idx !== c.idx && c.q) { rec.q = c.q; rec.cat = c.cat || rec.cat; }
    if (rec.ta && rec.ta.at && new Date(rec.ta.at) >= new Date(c.at || 0)) return; // 旧的重复消息不覆盖
    rec.ta = { text: c.text, at: c.at || new Date().toISOString(), author: senderId || 'ta' };
    m[c.date] = rec; this._setAll(m);
    this.render();
    if (typeof Push !== 'undefined') Push.onDaily();
  },

  // ---------- 默契值 ----------
  // 由 sync 每次拉到消息时调用：mine/ta 是「我 / TA 写过答案的日期」集合。
  // 内容没变就不重绘，避免 1.5s 一次的轮询把界面刷得抖动。
  _fp: function(o) { var a = [], k; for (k in o) a.push(k); a.sort(); return a.join(','); },
  setRemoteDays: function(mine, ta) {
    var fp = this._fp(mine || {}) + '|' + this._fp(ta || {});
    if (fp === this._remoteFp) return;
    this._remoteFp = fp;
    this._remote = { mine: mine || {}, ta: ta || {} };
    this.render();
  },

  // 默契值 = 「两个人都写过答案」的天数。
  // 只算交集：单独一方写了不算，所以答完自己的不会 +1，要等 TA 也回信才 +1。
  tacit: function() {
    var k = this._key(), m = this._all(), days = {}, dk, n = 0;
    // 「我写过 / TA 写过」两个来源合并：本地记录（即时） + 远端消息（可补回被清掉的记录）
    for (dk in m) {
      if (!days[dk]) days[dk] = {};
      if (m[dk] && m[dk].mine) days[dk].mine = 1;
      if (m[dk] && m[dk].ta) days[dk].ta = 1;
    }
    for (dk in this._remote.mine) { if (!days[dk]) days[dk] = {}; days[dk].mine = 1; }
    for (dk in this._remote.ta) { if (!days[dk]) days[dk] = {}; days[dk].ta = 1; }
    for (dk in days) { if (days[dk].mine && days[dk].ta) n++; }
    return { total: n, todayDone: !!(days[k] && days[k].mine && days[k].ta) };
  },

  // ---------- 界面 ----------
  _openPast: false,
  togglePast: function() { this._openPast = !this._openPast; this.render(); },

  // 两个交叠的心（手绘 SVG，不用 emoji，避免各机型配色不一）
  _hearts: function() {
    var d = 'M12 20.35l-1.45-1.32C5.4 14.36 2 11.28 2 7.5 2 4.42 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09C13.09 2.81 14.76 2 16.5 2 19.58 2 22 4.42 22 7.5c0 3.78-3.4 6.86-8.55 11.54L12 20.35z';
    return '<svg class="dc-hearts" width="32" height="22" viewBox="0 0 32 22" aria-hidden="true" focusable="false">' +
      '<path d="' + d + '" fill="#E8B88A" opacity="0.45" transform="translate(9.6 3) scale(0.78)"/>' +
      '<path d="' + d + '" fill="#E5989B" transform="translate(2.4 2.6) scale(0.8)"/>' +
      '</svg>';
  },

  render: function() {
    var el = document.getElementById('daily-section');
    if (!el) return;
    var k = this._key(), rec = this._day(k);
    var paired = (typeof Sync !== 'undefined' && !!Sync.partnerId);
    var pn = localStorage.getItem('sync_partnerName') || 'TA';

    var h = '<div class="card daily-card">';

    // 顶部：邮票样式的贴纸（不再是「今天还没打卡」那种打卡味）
    h += '<div class="dc-head"><span class="dc-stamp">' + escapeHtml(formatMonthDay(new Date())) + ' · 心里话</span></div>';

    // 问题区：没拆过就被色块盖住
    if (rec.opened) {
      h += '<div class="dc-question">' + escapeHtml(rec.q || '') + '</div>';
    } else {
      h += '<div class="dc-scratch" id="dc-scratch" onclick="Daily.reveal()"><span class="dc-scratch-txt">轻触开启今日密信 ✉️</span></div>';
    }

    // 回答区
    if (rec.opened) {
      if (rec.mine) {
        h += '<div class="dc-sealed" onclick="Daily.openSheet()">' +
          '<span class="dc-sealed-txt">' + escapeHtml(rec.mine.text) + '</span>' +
          '<span class="dc-sealed-tag">已封存</span></div>';
      } else if (!paired) {
        h += '<p class="dc-note">和 TA 连接之后，这封信才能寄出去</p>';
      } else {
        h += '<div class="dc-write" onclick="Daily.openSheet()">点击此处写下回答...</div>';
      }
    }

    // TA 的回信（要等我先封存，免得互相影响）
    if (rec.mine && paired) {
      if (rec.ta) {
        h += '<div class="dc-from-ta"><span class="dc-from-ta-who">' + escapeHtml(pn) + ' 的回信</span>' +
          '<div class="dc-from-ta-text">' + escapeHtml(rec.ta.text) + '</div></div>';
      } else {
        h += '<p class="dc-note">等 ' + escapeHtml(pn) + ' 拆开今天的信…</p>';
      }
    }

    // 往期密信
    var m = this._all(), past = [];
    for (var dk in m) { if (dk !== k && (m[dk].mine || m[dk].ta)) past.push(dk); }
    past.sort().reverse();
    if (past.length) {
      h += '<div class="dc-past-head" onclick="Daily.togglePast()">' +
        (this._openPast ? '收起往期密信' : '往期密信 · ' + past.length + ' 封') + '</div>';
      if (this._openPast) {
        h += '<div class="dc-past">';
        for (var i = 0; i < past.length && i < 60; i++) {
          var p = m[past[i]];
          h += '<div class="dc-past-item"><div class="dc-past-date">' + escapeHtml(past[i]) + '</div>' +
            '<div class="dc-past-q">' + escapeHtml(p.q || '') + '</div>' +
            '<div class="dc-past-a"><span class="dc-tag">我</span>' + (p.mine ? escapeHtml(p.mine.text) : '<i>没写</i>') + '</div>' +
            '<div class="dc-past-a"><span class="dc-tag ta">' + escapeHtml(pn) + '</span>' + (p.ta ? escapeHtml(p.ta.text) : '<i>没写</i>') + '</div></div>';
        }
        h += '</div>';
      }
    }

    // 底部：交叠的心 + 默契值（真的会涨：双方都回信的那天才 +1）
    var tk = this.tacit();
    h += '<div class="dc-foot">' + this._hearts() +
      '<span class="dc-foot-txt">默契值 ' + tk.total + '</span>' +
      (tk.todayDone ? '<span class="dc-foot-up">今天 +1</span>' : '') + '</div>';
    h += '</div>';
    el.innerHTML = h;
  },

  init: function() { this.render(); }
};
