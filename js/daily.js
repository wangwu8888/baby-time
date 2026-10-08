// ==================== 每日一题（v118） ====================
// 双方每天看到的是同一道题——不需要商量，靠「日期哈希」各自算出同一个下标。
// 答案复用 messages 表（type='daily_q'），已经上了 RLS，只有房间成员能读，不用新建表。
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
    if (!m[k]) { m[k] = { idx: this._idxFor(k), q: this._qFor(k)[1], cat: this._qFor(k)[0], mine: null, ta: null }; this._setAll(m); }
    return m[k];
  },

  // ---------- 打卡统计 ----------
  _streak: function() {
    var m = this._all(), n = 0, d = new Date();
    // 今天还没答的话，从昨天开始算连续
    if (!(m[this._key(d)] && m[this._key(d)].mine)) d.setDate(d.getDate() - 1);
    while (true) {
      var rec = m[this._key(d)];
      if (rec && rec.mine) { n++; d.setDate(d.getDate() - 1); } else break;
      if (n > 999) break;
    }
    return n;
  },
  _bothDays: function() {
    var m = this._all(), n = 0;
    for (var k in m) { if (m[k] && m[k].mine && m[k].ta) n++; }
    return n;
  },

  // ---------- 我回答 ----------
  answer: function(text) {
    text = (text || '').trim();
    if (!text) { showToast('写点什么再提交吧'); return; }
    if (!text) return;
    if (typeof Sync === 'undefined' || !Sync.roomId || !Sync.partnerId) { showToast('先和 TA 连接上再回答吧'); return; }
    var k = this._key(), rec = this._day(k);
    rec.mine = { text: text, at: new Date().toISOString() };
    var m = this._all(); m[k] = rec; this._setAll(m);
    Sync.sendDailyAnswer(k, rec.idx, rec.q, text);
    this.render();
    showToast('已提交，等 TA 回答后就能互相看到 💭');
  },

  reAnswer: function() {
    var k = this._key(), rec = this._day(k);
    var t = prompt('重新回答今天的题：', (rec.mine && rec.mine.text) || '');
    if (t === null) return;
    if (!t.trim()) return;
    this.answer(t.trim());
  },

  // ---------- 收到 TA 的答案 ----------
  applyRemote: function(c, senderId) {
    if (!c || !c.date || !c.text) return;
    var m = this._all();
    var rec = m[c.date];
    if (!rec) { rec = { idx: c.idx, q: c.q || '', cat: c.cat || '', mine: null, ta: null }; }
    // 版本不一致时，以 TA 带过来的题目为准展示
    if (typeof c.idx === 'number' && rec.idx !== c.idx && c.q) { rec.q = c.q; rec.cat = c.cat || rec.cat; }
    if (rec.ta && rec.ta.at && new Date(rec.ta.at) >= new Date(c.at || 0)) return; // 旧的重复消息不覆盖
    rec.ta = { text: c.text, at: c.at || new Date().toISOString(), author: senderId || 'ta' };
    m[c.date] = rec; this._setAll(m);
    this.render();
    if (typeof Push !== 'undefined') Push.onDaily();
  },

  // ---------- 界面 ----------
  _openPast: false,
  togglePast: function() { this._openPast = !this._openPast; this.render(); },

  render: function() {
    var el = document.getElementById('daily-section');
    if (!el) return;
    var k = this._key(), rec = this._day(k);
    var paired = (typeof Sync !== 'undefined' && !!Sync.partnerId);
    var pn = localStorage.getItem('sync_partnerName') || 'TA';
    var streak = this._streak(), both = this._bothDays();

    var html = '<div class="card daily-card">';
    html += '<div class="daily-head"><div class="card-title" style="margin:0">📅 每日一题</div>';
    html += '<span class="daily-streak">' + (streak > 0 ? '连续 ' + streak + ' 天 🔥' : '今天还没打卡') + '</span></div>';
    html += '<div class="daily-cat">' + formatMonthDay(new Date()) + ' · ' + escapeHtml(rec.cat || '') + '</div>';
    html += '<div class="daily-q">' + escapeHtml(rec.q || '') + '</div>';

    // 我的回答
    if (rec.mine) {
      html += '<div class="daily-ans mine"><div class="daily-ans-who">我的回答' +
        '<button class="btn-text daily-edit" onclick="Daily.reAnswer()">改</button></div>' +
        '<div class="daily-ans-text">' + escapeHtml(rec.mine.text) + '</div></div>';
    } else if (!paired) {
      html += '<p class="empty-hint">和 TA 连接之后，这里每天都会出现一道题</p>';
    } else {
      html += '<textarea id="daily-input" class="entry-textarea" rows="2" placeholder="写下你的回答…（提交后 TA 答完就能互相看到）"></textarea>';
      html += '<div style="text-align:right;margin-top:8px"><button class="btn-primary" onclick="Daily.answer(document.getElementById(\'daily-input\').value)">提交回答</button></div>';
    }

    // TA 的回答
    if (rec.mine && paired) {
      if (rec.ta) {
        html += '<div class="daily-ans ta"><div class="daily-ans-who">' + escapeHtml(pn) + '的回答</div>' +
          '<div class="daily-ans-text">' + escapeHtml(rec.ta.text) + '</div></div>';
      } else {
        html += '<div class="daily-wait">⏳ 等 ' + escapeHtml(pn) + ' 回答…</div>';
      }
    }

    // 往期
    var m = this._all(), past = [];
    for (var dk in m) { if (dk !== k && (m[dk].mine || m[dk].ta)) past.push(dk); }
    past.sort().reverse();
    if (past.length) {
      html += '<div class="daily-past-head" onclick="Daily.togglePast()">' + (this._openPast ? '▼' : '▶') + ' 往期回顾（' + past.length + ' 天）</div>';
      if (this._openPast) {
        html += '<div class="daily-past">';
        for (var i = 0; i < past.length && i < 60; i++) {
          var p = m[past[i]];
          html += '<div class="daily-past-item"><div class="daily-past-date">' + escapeHtml(past[i]) + (p.cat ? ' · ' + escapeHtml(p.cat) : '') + '</div>' +
            '<div class="daily-past-q">' + escapeHtml(p.q || '') + '</div>' +
            '<div class="daily-past-a"><span class="daily-tag">我</span>' + (p.mine ? escapeHtml(p.mine.text) : '<i>没答</i>') + '</div>' +
            '<div class="daily-past-a"><span class="daily-tag ta">' + escapeHtml(pn) + '</span>' + (p.ta ? escapeHtml(p.ta.text) : '<i>没答</i>') + '</div></div>';
        }
        html += '</div>';
      }
    }

    html += '<div class="daily-foot">你们已经一起回答了 ' + both + ' 天 💞</div>';
    html += '</div>';
    el.innerHTML = html;
  },

  init: function() { this.render(); }
};
