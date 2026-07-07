/* app.js — 화면 라우팅 + 렌더링 (프레임워크 없음, MVP) */
const S = window.Store;
const K = window.KPI;

let view = { name: 'players', params: {} };
const go = (name, params = {}) => { view = { name, params }; render(); window.scrollTo(0, 0); };

const el = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const initials = (n) => (n || '?').trim().slice(0, 2);

/* 작대기(tally) 표기 — 5개 묶음(정자 대신 |||| + 사선). 손으로 그린 듯 살짝 기울임 */
function tallyGroup(k) {
  const xs = [3, 7.5, 12, 16.5], sl = [.6, -.5, .5, -.6];
  let l = '';
  for (let i = 0; i < Math.min(k, 4); i++) l += `<line x1="${xs[i]}" y1="2.5" x2="${xs[i] + sl[i]}" y2="16" />`;
  if (k >= 5) l += `<line x1="1.5" y1="15" x2="20" y2="3.5" />`;
  return `<svg width="22" height="18" viewBox="0 0 22 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">${l}</svg>`;
}
function tallyMarks(n) {
  n = Math.max(0, n | 0);
  if (!n) return '';
  const groups = [];
  let left = Math.min(n, 60); // 표시 상한(숫자가 정본)
  while (left > 0) { groups.push(Math.min(5, left)); left -= 5; }
  return groups.map(tallyGroup).join('');
}
function paintCount(cell, v) {
  cell.querySelector('[data-cnt]').textContent = v;
  const t = cell.querySelector('[data-tally]'); if (t) t.innerHTML = tallyMarks(v);
}

const MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0"/><path d="M12 17v4"/></svg>';

/* 음성 기록: 지원 브라우저(Chrome 등)는 말한 내용을 메모에 실시간 추가.
   미지원 시 안내. (다음 단계: 음성 원본 저장 → 전체 텍스트 + 요약 자동 생성) */
let _recog = null, _recOn = false;
function toggleVoice(btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!_recOn) {
    if (!SR) { toast('이 브라우저는 음성인식 미지원 — 직접 입력해 주세요'); return; }
    _recog = new SR(); _recog.lang = 'ko-KR'; _recog.continuous = true; _recog.interimResults = false;
    _recog.onresult = (e) => {
      const ta = el('ev-memo'); if (!ta) return;
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      t = t.trim(); if (t) ta.value = (ta.value ? ta.value + ' ' : '') + t;
    };
    _recog.onend = () => { _recOn = false; paintMic(); };
    try { _recog.start(); _recOn = true; toast('● 녹음 중 — 말하면 메모에 적혀요'); } catch (_) {}
  } else {
    try { _recog && _recog.stop(); } catch (_) {}
    _recOn = false; toast('녹음 종료');
  }
  paintMic();
}
function paintMic() {
  const b = document.querySelector('[data-act="voice"]');
  if (!b) return;
  b.classList.toggle('rec', _recOn);
  const l = b.querySelector('.mlab'); if (l) l.textContent = _recOn ? '녹음 중지' : '녹음하며 기록';
}

function toast(msg) {
  let t = el('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1300);
}

/* ---------- 녹화(기록) 버튼 정의: 클릭 = +1 ---------- */
const REC_GROUPS = [
  { title: '공격', items: [
    ['shot', '슈팅', ''], ['shotOnTarget', '유효슈팅', 'pos'], ['goal', '득점', 'pos'],
    ['assist', '도움', 'pos'], ['keyPass', '키패스', 'pos'], ['bigChance', '빅찬스', 'pos'],
  ] },
  { title: '패스 · 드리블', items: [
    ['passSuccess', '패스 성공', 'pos'], ['passFail', '패스 실패', 'neg'], ['cross', '크로스', ''],
    ['dribbleSuccess', '드리블 성공', 'pos'], ['dribbleFail', '드리블 실패', 'neg'], ['touch', '터치', ''],
  ] },
  { title: '수비 · 활동량', items: [
    ['tackleSuccess', '태클 성공', 'pos'], ['tackleFail', '태클 실패', 'neg'], ['intercept', '인터셉트', 'pos'],
    ['clear', '클리어링', 'pos'], ['duelWon', '경합 승리', 'pos'], ['header', '헤더', ''],
  ] },
  { title: '기타', items: [
    ['foul', '파울', 'neg'], ['yellow', '경고', 'neg'], ['red', '퇴장', 'neg'],
  ] },
];

const EVAL_ITEMS = [
  ['footballIQ', '축구 IQ'], ['spatial', '공간 이해도'], ['tactical', '전술 이해도'], ['pressing', '압박 능력'],
  ['mental', '멘탈'], ['leadership', '리더십'], ['potential', '잠재력'], ['growth', '성장 가능성'],
];

/* ---------- SVG 레이더 차트 ---------- */
function radarSVG(scores, order, labels) {
  const W = 340, H = 296, cx = W / 2, cy = 138, R = 84, n = order.length;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  const toXY = (i, val) => pt(i, R * Math.max(0, Math.min(100, val)) / 100);

  const C = { grid: 'rgba(38,52,76,.30)', label: '#6d6a5c', accent: '#33507c', fill: 'rgba(51,80,124,.13)', stroke: '#33507c' };
  const rough = `<defs><filter id="rgh"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter></defs>`;
  let grid = '';
  for (const ring of [0.25, 0.5, 0.75, 1]) {
    const p = order.map((_, i) => pt(i, R * ring).join(',')).join(' ');
    grid += `<polygon points="${p}" fill="none" stroke="${C.grid}" stroke-width="1"/>`;
  }
  let spokes = '', axisLabels = '';
  order.forEach((key, i) => {
    const [x, y] = pt(i, R);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${C.grid}" stroke-dasharray="3 3"/>`;
    const [lx, ly] = pt(i, R + 22);
    const anchor = Math.abs(lx - cx) < 12 ? 'middle' : (lx < cx ? 'end' : 'start');
    axisLabels += `<text x="${lx}" y="${ly - 3}" text-anchor="${anchor}" font-size="11.5" font-weight="700" fill="${C.label}">${esc(labels[key])}</text>`;
    axisLabels += `<text x="${lx}" y="${ly + 11}" text-anchor="${anchor}" font-size="11" font-weight="800" fill="${C.accent}">${scores[key]}점</text>`;
  });
  const poly = order.map((k, i) => toXY(i, scores[k]).map((v) => v.toFixed(1)).join(',')).join(' ');
  const dots = order.map((k, i) => { const [x, y] = toXY(i, scores[k]); return `<circle cx="${x}" cy="${y}" r="3" fill="${C.stroke}"/>`; }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" style="max-width:340px" role="img" aria-label="KPI 레이더">
    ${rough}
    <g filter="url(#rgh)">${grid}${spokes}
      <polygon points="${poly}" fill="${C.fill}" stroke="${C.stroke}" stroke-width="1.8" stroke-linejoin="round"/></g>
    ${dots}${axisLabels}</svg>`;
}

/* ================= 화면들 ================= */

function screenPlayers() {
  const players = S.players();
  const body = players.length ? players.map((p) => {
    const { sum, games } = S.aggregate(p.id);
    const overall = games ? K.overallScore(K.computeKpi(sum, games).scores) : null;
    return `<div class="card row" data-nav="report" data-id="${p.id}">
      <div class="avatar">${esc(initials(p.name))}</div>
      <div class="grow">
        <div class="title">${esc(p.name)}</div>
        <div class="sub">${esc(p.position || '-')} · ${esc(p.team || '-')} · ${games}경기</div>
      </div>
      ${overall != null ? `<div class="score-big">${overall}</div>` : '<span class="badge">기록 전</span>'}
      <div class="chev">›</div>
    </div>`;
  }).join('') : `<div class="empty"><div class="big">⚽</div>등록된 선수가 없어요.<br>아래 + 버튼으로 선수를 추가하세요.</div>`;

  return { title: '선수', html: `<div class="screen">
    <div class="section-title">선수 ${players.length}명 · 종합 가치 점수</div>${body}
  </div><button class="fab" data-nav="addPlayer">＋</button>`, tab: 'players' };
}

function screenAddPlayer() {
  return { title: '선수 등록', back: 'players', html: `<div class="screen">
    <label class="field"><span>선수명 *</span><input id="f-name" placeholder="예: 이승원"></label>
    <label class="field"><span>포지션</span>
      <select id="f-pos"><option value="">선택</option>
      ${['ST', 'CF', 'LW', 'RW', 'CAM', 'CM', 'CDM', 'LB', 'RB', 'CB', 'GK'].map((x) => `<option>${x}</option>`).join('')}</select></label>
    <label class="field"><span>소속팀</span><input id="f-team" placeholder="예: OO FC U-15"></label>
    <label class="field"><span>학년</span><input id="f-grade" placeholder="예: 중2"></label>
    <div class="stat-list">
      <label class="field"><span>주발</span><select id="f-foot"><option>오른발</option><option>왼발</option><option>양발</option></select></label>
      <label class="field"><span>신장(cm)</span><input id="f-height" inputmode="numeric" placeholder="170"></label>
    </div>
    <button class="btn gold" data-act="savePlayer">등록하기</button>
  </div>` };
}

function screenMatches() {
  const matches = S.matches();
  const body = matches.length ? matches.map((m) => `<div class="card row" data-nav="record" data-id="${m.id}">
      <div class="avatar" style="background:#eee;color:#8a8a8a">${m.status === 'live' ? '●' : '✓'}</div>
      <div class="grow">
        <div class="title">${esc(m.name || 'vs ' + (m.opponent || ''))}</div>
        <div class="sub">${esc(m.date || '')} · ${esc(m.place || '-')} ${m.competition ? '· ' + esc(m.competition) : ''}</div>
      </div>
      ${m.status === 'live' ? '<span class="badge gold">기록중</span>' : '<span class="badge">종료</span>'}
      <div class="chev">›</div>
    </div>`).join('') : `<div class="empty"><div class="big">📋</div>경기가 없어요.<br>+ 버튼으로 경기를 만드세요.</div>`;
  return { title: '경기', html: `<div class="screen">${body}</div><button class="fab" data-nav="addMatch">＋</button>`, tab: 'matches' };
}

function screenAddMatch() {
  const today = new Date().toISOString().slice(0, 10);
  return { title: '경기 생성', back: 'matches', html: `<div class="screen">
    <label class="field"><span>경기명</span><input id="m-name" placeholder="예: 주말리그 3R"></label>
    <label class="field"><span>날짜</span><input id="m-date" type="date" value="${today}"></label>
    <label class="field"><span>상대팀 *</span><input id="m-opp" placeholder="예: XX FC"></label>
    <div class="stat-list">
      <label class="field"><span>장소</span><input id="m-place" placeholder="OO구장"></label>
      <label class="field"><span>대회명</span><input id="m-comp" placeholder="주말리그"></label>
    </div>
    <button class="btn gold" data-act="saveMatch">경기 시작</button>
  </div>` };
}

let recPid = null; // 현재 기록 대상 선수
function screenRecord(mid) {
  const m = S.match(mid);
  if (!m) { go('matches'); return { title: '', html: '' }; }
  const players = S.players();
  if (!players.length) return { title: esc(m.name || '기록'), back: 'matches',
    html: `<div class="screen"><div class="empty"><div class="big">🙋</div>먼저 선수를 등록하세요.</div><button class="btn gold" data-nav="addPlayer">선수 등록</button></div>` };

  if (!recPid || !S.player(recPid)) recPid = players[0].id;
  const rec = S.record(recPid, mid);

  const strip = players.map((p) => `<button class="chip ${p.id === recPid ? 'active' : ''}" data-act="pickPlayer" data-id="${p.id}">${esc(p.name)}</button>`).join('');
  const groups = REC_GROUPS.map((g) => `<div class="rec-group"><h3>${g.title}</h3><div class="rec-grid">
    ${g.items.map(([key, lab, cls]) => `<div class="tap ${cls}" data-act="tap" data-stat="${key}">
        <button class="minus" data-act="untap" data-stat="${key}">−</button>
        <div class="lab">${lab}</div>
        <div class="num" data-cnt="${key}">${rec.stats[key] || 0}</div>
        <div class="tally" data-tally="${key}">${tallyMarks(rec.stats[key] || 0)}</div>
      </div>`).join('')}</div></div>`).join('');

  const footer = m.status === 'live'
    ? `<button class="btn gold" data-act="evalOpen" data-id="${mid}">정성 평가 →</button>
       <div style="height:10px"></div>
       <button class="btn" data-act="finish" data-id="${mid}">경기 종료</button>`
    : `<button class="btn gold" data-nav="report" data-id="${recPid}">${esc(S.player(recPid).name)} 리포트 보기 →</button>`;

  return {
    title: esc(m.name || 'vs ' + m.opponent), back: 'matches', live: m.status === 'live',
    html: `<div class="screen">
      <div class="player-strip">${strip}</div>
      <div class="rec-groups">${groups}</div>
      <div style="height:16px"></div>${footer}
    </div>`,
  };
}

function screenEval(mid) {
  const m = S.match(mid); const p = S.player(recPid);
  if (!m || !p) { go('matches'); return { title: '', html: '' }; }
  const ev = S.evaluation(p.id, mid);
  const rows = EVAL_ITEMS.map(([key, lab]) => `<div class="eval-row">
      <span class="name">${lab}</span>
      <div class="stars" data-key="${key}">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= ev.ratings[key] ? 'on' : ''}" data-act="star" data-key="${key}" data-v="${i}">★</span>`).join('')}</div>
    </div>`).join('');
  return { title: '정성 평가', back: 'record',
    html: `<div class="screen">
      <div class="card row"><div class="avatar">${esc(initials(p.name))}</div><div class="grow"><div class="title">${esc(p.name)}</div><div class="sub">${esc(m.name || '')}</div></div></div>
      <div class="card">${rows}</div>
      <label class="field"><span>추가 메모</span>
        <div class="memo-head">
          <button class="micbtn" data-act="voice">${MIC_SVG}<span class="mlab">녹음하며 기록</span></button>
          <span class="micnote">음성 → 전체 텍스트 + 요약<br>자동 생성 (예정)</span>
        </div>
        <textarea id="ev-memo" placeholder="경기 집중력, 판단, 패스 선택 등 — 직접 쓰거나 🎙 눌러 말하세요">${esc(ev.memo)}</textarea>
      </label>
      <button class="btn gold" data-act="saveEval" data-id="${mid}">평가 저장</button>
    </div>` };
}

function screenReport(pid) {
  const p = S.player(pid);
  if (!p) { go('players'); return { title: '', html: '' }; }
  const { sum, games } = S.aggregate(pid);

  if (!games) return { title: esc(p.name), back: 'players',
    html: `<div class="screen"><div class="empty"><div class="big">📊</div>완료된 경기 기록이 없어요.<br>경기를 기록·종료하면 리포트가 생성됩니다.</div></div>` };

  const kpi = K.computeKpi(sum, games);
  const overall = K.overallScore(kpi.scores);

  const legend = kpi.order.map((key) => {
    const b = kpi.breakdown[key];
    const detail = b.metrics.map((r) => `${r.label} ${r.value.toFixed(2)} (Z ${r.z})`).join(' · ');
    return `<div class="li"><div><div>${esc(kpi.labels[key])}</div><div class="small muted">${esc(detail)}</div></div><b>${kpi.scores[key]}점</b></div>`;
  }).join('');

  const keyStats = [
    ['경기', games], ['득점', sum.goal], ['도움', sum.assist],
    ['슈팅', sum.shot], ['유효슈팅', sum.shotOnTarget], ['키패스', sum.keyPass],
    ['패스성공률', ((sum.passSuccess / Math.max(1, sum.passSuccess + sum.passFail)) * 100).toFixed(0) + '%'],
    ['태클', sum.tackleSuccess], ['인터셉트', sum.intercept], ['경합승리', sum.duelWon],
  ];

  return { title: esc(p.name), back: 'players',
    html: `<div class="screen">
      <div class="card" style="text-align:center">
        <div class="avatar" style="margin:0 auto 8px">${esc(initials(p.name))}</div>
        <div class="title" style="font-size:18px">${esc(p.name)}</div>
        <div class="sub">${esc(p.position || '-')} · ${esc(p.team || '-')} · ${esc(p.grade || '')}</div>
        <div style="margin-top:12px"><span class="badge gold" style="font-size:13px">종합 가치 ${overall}점</span></div>
      </div>
      <div class="card"><div class="radar-wrap">${radarSVG(kpi.scores, kpi.order, kpi.labels)}</div>
        <div class="kpi-legend">${legend}</div></div>
      <div class="section-title">시즌 누적 기록 (${games}경기)</div>
      <div class="card"><div class="stat-list">
        ${keyStats.map(([k, v]) => `<div class="stat-cell"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}
      </div></div>
    </div>` };
}

/* ================= 렌더 + 이벤트 위임 ================= */
const SCREENS = {
  players: screenPlayers, addPlayer: screenAddPlayer, matches: screenMatches,
  addMatch: screenAddMatch, record: () => screenRecord(view.params.id),
  eval: () => screenEval(view.params.id), report: () => screenReport(view.params.id),
};

const TAB_ICONS = {
  players: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4 20c0-3.3 3.6-5.5 8-5.5s8 2.2 8 5.5"/>',
  matches: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5 15 10l-1.2 3.6H10.2L9 10l3-2.5Z"/>',
  reports: '<path d="M5 20V11M12 20V5M19 20v-6"/>',
};
function svgIcon(name) {
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TAB_ICONS[name]}</svg>`;
}
function tabbar(active) {
  const t = [['players', '선수'], ['matches', '경기'], ['reportsHome', '리포트']];
  return `<div class="tabbar">${t.map(([k, lab]) => {
    const target = k === 'reportsHome' ? 'players' : k;
    const iconName = k === 'reportsHome' ? 'reports' : k;
    const on = (active === k) || (k === 'reportsHome' && view.name === 'report');
    return `<button data-nav="${target}" class="${on ? 'active' : ''}">${svgIcon(iconName)}${lab}</button>`;
  }).join('')}</div>`;
}

function render() {
  const s = SCREENS[view.name]();
  const bar = `<div class="topbar">
    ${s.back ? `<button class="back" data-nav="${s.back}">‹</button>` : '<span class="back"></span>'}
    <h1>${s.title || ''}</h1>${s.live ? '<span class="live">● 기록중</span>' : ''}</div>`;
  const showTabs = ['players', 'matches'].includes(view.name) || view.name === 'report';
  el('app').innerHTML = bar + s.html + (showTabs ? tabbar(s.tab || (view.name === 'report' ? 'reportsHome' : '')) : '');
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) { go(nav.dataset.nav, nav.dataset.id ? { id: nav.dataset.id } : {}); return; }
  const act = e.target.closest('[data-act]');
  if (!act) return;
  const a = act.dataset.act;

  if (a === 'savePlayer') {
    const name = el('f-name').value.trim();
    if (!name) return toast('선수명을 입력하세요');
    S.addPlayer({ name, position: el('f-pos').value, team: el('f-team').value.trim(),
      grade: el('f-grade').value.trim(), foot: el('f-foot').value, height: el('f-height').value.trim() });
    toast('선수 등록 완료'); go('players');
  } else if (a === 'saveMatch') {
    const opp = el('m-opp').value.trim();
    if (!opp) return toast('상대팀을 입력하세요');
    const m = S.addMatch({ name: el('m-name').value.trim() || 'vs ' + opp, date: el('m-date').value,
      opponent: opp, place: el('m-place').value.trim(), competition: el('m-comp').value.trim() });
    toast('경기 시작'); go('record', { id: m.id });
  } else if (a === 'pickPlayer') {
    recPid = act.dataset.id; render();
  } else if (a === 'tap') {
    const v = S.tally(recPid, view.params.id, act.dataset.stat, +1);
    paintCount(act, v);
    if (navigator.vibrate) navigator.vibrate(8);
  } else if (a === 'untap') {
    e.stopPropagation();
    const v = S.tally(recPid, view.params.id, act.dataset.stat, -1);
    paintCount(act.closest('.tap'), v);
  } else if (a === 'finish') {
    if (confirm('경기를 종료하고 통계를 확정할까요?')) { S.finishMatch(act.dataset.id); toast('경기 종료 · 통계 확정'); go('report', { id: recPid }); }
  } else if (a === 'evalOpen') {
    go('eval', { id: act.dataset.id });
  } else if (a === 'voice') {
    toggleVoice(act.closest('[data-act="voice"]'));
  } else if (a === 'star') {
    const ev = S.evaluation(recPid, view.params.id);
    const ta = el('ev-memo'); if (ta) ev.memo = ta.value; // 별점 눌러도 메모 유지
    ev.ratings[act.dataset.key] = +act.dataset.v; S._commit(); render();
  } else if (a === 'saveEval') {
    S.saveEvaluation(recPid, act.dataset.id, { memo: el('ev-memo').value });
    toast('평가 저장 완료'); go('record', { id: act.dataset.id });
  }
});

/* ---------- 데모 시드 (첫 실행 시 예시 선수 1명 + 종료 경기 3개) ---------- */
function seedDemo() {
  if (S.players().length) return;
  const p = S.addPlayer({ name: '이승원', position: 'CAM', team: 'K유소년 U-15', grade: '중3', foot: '오른발', height: '172' });
  // 기획서 레이더에 근접하도록 3경기치 로데이터 시드
  const perGame = { shot: 6, shotOnTarget: 2, goal: 1, assist: 1, keyPass: 1, bigChance: 3,
    passSuccess: 41, passFail: 9, dribbleSuccess: 3, dribbleFail: 2, cross: 2, touch: 47,
    tackleSuccess: 2, tackleFail: 1, intercept: 1, clear: 1, duelWon: 6, header: 3, foul: 1, yellow: 0, red: 0 };
  ['1R', '2R', '3R'].forEach((r, i) => {
    const m = S.addMatch({ name: `주말리그 ${r}`, date: `2025-03-0${i + 1}`, opponent: `상대 ${i + 1}팀`, place: 'OO구장', competition: '주말리그' });
    for (const [k, v] of Object.entries(perGame)) S.tally(p.id, m.id, k, v);
    S.finishMatch(m.id);
  });
}

seedDemo();
render();
