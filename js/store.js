/*
 * store.js — MVP 데이터 계층 (localStorage)
 * ------------------------------------------------------------------
 * "소규모 서버 저장" 전략: Pilot 단계는 백엔드 없이 브라우저 localStorage로 검증하고,
 * 스키마는 향후 Supabase(Postgres) 테이블과 1:1로 맞춰 마이그레이션 비용을 0에 가깝게 만든다.
 *
 * 테이블 매핑
 *   players        → players
 *   matches        → matches
 *   records[pid+mid] → match_records  (선수 x 경기 = 1행, 클릭 카운터 누적)
 *   evals[pid+mid]  → qualitative_evaluations (정성 평가 별점 + 메모)
 *
 * 이벤트 단위가 아니라 "경기당 집계 1행"으로 저장 → 오버엔지니어링 방지.
 * (되돌리기는 카운터 -1 로 충분, 감사로그가 필요해지면 그때 event 테이블 추가)
 */
const STAT_KEYS = [
  'passSuccess', 'passFail', 'shot', 'shotOnTarget', 'goal', 'assist',
  'keyPass', 'bigChance', 'dribbleSuccess', 'dribbleFail',
  'tackleSuccess', 'tackleFail', 'intercept', 'clear', 'duelWon', 'touch',
  'cross', 'header', 'foul', 'yellow', 'red',
];

const DB_KEY = 'ysp_db_v1';

function emptyStats() {
  const o = {};
  for (const k of STAT_KEYS) o[k] = 0;
  return o;
}

function load() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { players: [], matches: [], records: {}, evals: {} };
}

function save(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const rkey = (pid, mid) => `${pid}__${mid}`;

const Store = {
  db: load(),
  STAT_KEYS,
  emptyStats,

  _commit() { save(this.db); },

  // ---- players ----
  players() { return this.db.players; },
  player(id) { return this.db.players.find((p) => p.id === id); },
  addPlayer(p) {
    const player = { id: uid(), createdAt: Date.now(), ...p };
    this.db.players.push(player); this._commit();
    return player;
  },

  // ---- matches ----
  matches() { return [...this.db.matches].sort((a, b) => (b.date || '').localeCompare(a.date || '')); },
  match(id) { return this.db.matches.find((m) => m.id === id); },
  addMatch(m) {
    const match = { id: uid(), createdAt: Date.now(), status: 'live', ...m };
    this.db.matches.push(match); this._commit();
    return match;
  },
  finishMatch(id) {
    const m = this.match(id); if (m) { m.status = 'done'; this._commit(); }
  },

  // ---- records (선수 x 경기 카운터) ----
  record(pid, mid) {
    const k = rkey(pid, mid);
    if (!this.db.records[k]) this.db.records[k] = { pid, mid, stats: emptyStats() };
    return this.db.records[k];
  },
  tally(pid, mid, stat, delta = 1) {
    const r = this.record(pid, mid);
    r.stats[stat] = Math.max(0, (r.stats[stat] || 0) + delta);
    this._commit();
    return r.stats[stat];
  },

  // 선수의 완료된 경기 전체 누적 합 + 경기 수
  aggregate(pid) {
    const sum = emptyStats();
    let games = 0;
    for (const m of this.db.matches) {
      if (m.status !== 'done') continue;
      const r = this.db.records[rkey(pid, m.id)];
      if (!r) continue;
      games += 1;
      for (const k of STAT_KEYS) sum[k] += r.stats[k] || 0;
    }
    return { sum, games };
  },

  // ---- qualitative evaluation ----
  evaluation(pid, mid) {
    const k = rkey(pid, mid);
    if (!this.db.evals[k]) {
      this.db.evals[k] = {
        pid, mid, memo: '',
        ratings: { footballIQ: 0, spatial: 0, tactical: 0, pressing: 0, mental: 0, leadership: 0, potential: 0, growth: 0 },
      };
    }
    return this.db.evals[k];
  },
  saveEvaluation(pid, mid, data) {
    const e = this.evaluation(pid, mid);
    Object.assign(e, data); this._commit();
  },

  reset() { this.db = { players: [], matches: [], records: {}, evals: {} }; this._commit(); },
};

window.Store = Store;
