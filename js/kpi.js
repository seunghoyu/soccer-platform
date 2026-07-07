/*
 * kpi.js — 유소년 선수 가치 점수 모델 (T-Score 기반)
 * ------------------------------------------------------------------
 * 기획서의 핵심: 에이전트가 클릭으로 쌓은 로데이터를 → 표준화(Z) → 가중합 → 점수화(T)
 *   T = 50 + 10 * Z            (평균 50점, 표준편차 ±10점)
 *   Z = (선수값 - 리그평균) / 리그표준편차
 *   KPI = Σ (Z_i * weight_i)   (하위 지표들의 가중 합)
 *
 * 리그 기준값(mean/std)은 "2025 K리그 1~25R, 동일 포지션 10명" 표본에서 산출한다는
 * 기획서 전제를 따른다. 아래 값은 시드(예시)이며 REFERENCE 테이블만 갈아끼우면
 * 언제든 재보정 가능하다. (기획서: "가중치/기준은 평가 기준에 따라 조정 가능")
 *
 * ⚠ 데이터 출처가 공식 기관이 아닌 Sofascore 기록값이므로 신뢰도는 제한적 —
 *    기준값은 운영 중 지속 보정 대상이다.
 */

// std는 기획서 예시(이승원)에서 역산: (3.0-3.75)/Z(-0.26)=2.885, (0.8-1.47)/(-0.95)=0.705
const REFERENCE = {
  chanceCreation: {
    label: '기회 창출',
    metrics: {
      bigChance: { label: '경기당 빅찬스 창출', mean: 3.75, std: 2.885, weight: 0.6 },
      keyPass:   { label: '경기당 키패스',       mean: 1.47, std: 0.705, weight: 0.4 },
    },
  },
  scoring: {
    label: '득점 능력',
    metrics: {
      goalsPerGame:   { label: '경기당 득점',   mean: 0.45, std: 0.30, weight: 0.6 },
      conversionRate: { label: '득점 전환율',   mean: 0.14, std: 0.08, weight: 0.4 },
    },
  },
  linkup: {
    label: '연계 능력',
    metrics: {
      passSuccessRate: { label: '패스 성공률', mean: 0.82, std: 0.06,  weight: 0.5 },
      keyPass:         { label: '경기당 키패스', mean: 1.47, std: 0.705, weight: 0.5 },
    },
  },
  defense: {
    label: '수비력',
    metrics: {
      tacklesPerGame:    { label: '경기당 태클',   mean: 1.6, std: 0.9, weight: 0.5 },
      interceptsPerGame: { label: '경기당 인터셉트', mean: 1.1, std: 0.7, weight: 0.5 },
    },
  },
  stamina: {
    label: '체력',
    metrics: {
      touchesPerGame:  { label: '경기당 터치 수',   mean: 55, std: 18,  weight: 0.5 },
      duelsWonPerGame: { label: '경기당 경합 승리', mean: 5.5, std: 2.2, weight: 0.5 },
    },
  },
};

// 순서 = 레이더 차트 축 순서 (기획서 오각형과 동일)
const KPI_ORDER = ['chanceCreation', 'scoring', 'linkup', 'defense', 'stamina'];

/* 누적 카운트(sum) + 경기 수(games) → 하위 지표의 "경기당/비율" 실측값으로 변환 */
function deriveMetrics(sum, games) {
  const g = Math.max(1, games);
  const shots = sum.shot || 0;
  const passTotal = (sum.passSuccess || 0) + (sum.passFail || 0);
  return {
    bigChance:         (sum.bigChance || 0) / g,
    keyPass:           (sum.keyPass || 0) / g,
    goalsPerGame:      (sum.goal || 0) / g,
    conversionRate:    shots ? (sum.goal || 0) / shots : 0,
    passSuccessRate:   passTotal ? (sum.passSuccess || 0) / passTotal : 0,
    tacklesPerGame:    (sum.tackleSuccess || 0) / g,
    interceptsPerGame: (sum.intercept || 0) / g,
    touchesPerGame:    (sum.touch || 0) / g,
    duelsWonPerGame:   (sum.duelWon || 0) / g,
  };
}

function tScore(z) {
  const t = 50 + 10 * z;
  return Math.max(0, Math.min(100, t)); // 0~100 클램프
}

/*
 * 선수의 누적 스탯 → 5개 KPI 점수 + 계산 근거(breakdown) 반환.
 * 반환: { scores:{key:점수}, order, breakdown:{key:{label, z, metrics:[...] }} }
 */
function computeKpi(sum, games) {
  const m = deriveMetrics(sum, games);
  const scores = {};
  const breakdown = {};

  for (const key of KPI_ORDER) {
    const def = REFERENCE[key];
    let compositeZ = 0;
    const rows = [];
    for (const [mk, ref] of Object.entries(def.metrics)) {
      const value = m[mk] ?? 0;
      const z = ref.std ? (value - ref.mean) / ref.std : 0;
      compositeZ += z * ref.weight;
      rows.push({
        label: ref.label, value, mean: ref.mean,
        weight: ref.weight, z: +z.toFixed(2),
      });
    }
    scores[key] = +tScore(compositeZ).toFixed(1);
    breakdown[key] = { label: def.label, z: +compositeZ.toFixed(2), metrics: rows };
  }
  return { scores, order: KPI_ORDER, breakdown, labels: labelMap() };
}

function labelMap() {
  const out = {};
  for (const k of KPI_ORDER) out[k] = REFERENCE[k].label;
  return out;
}

/* 종합 가치 점수(요약 배지용) = 5개 KPI 단순 평균 */
function overallScore(scores) {
  const vals = KPI_ORDER.map((k) => scores[k]);
  return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

window.KPI = { REFERENCE, KPI_ORDER, computeKpi, overallScore, deriveMetrics, tScore };
