# 유소년 축구 선수 데이터 플랫폼 (Pilot)

> 에이전트가 경기를 보며 **클릭으로 기록**하고, 누적 데이터가 **하나의 가치 점수(레이더)** 로 확인되는 서비스.

## ▶️ 라이브 (GitHub Pages)

이 저장소를 GitHub에 올리고 **Settings → Pages → Source: GitHub Actions** 로 두면 자동 배포됩니다.

- 배포 URL: `https://<사용자명>.github.io/youth-soccer-data-platform/`

## ▶️ 로컬 실행 (빌드 불필요)

```bash
python3 -m http.server 8099
# http://localhost:8099 접속
```

첫 실행 시 데모 선수(이승원)와 3경기 기록이 자동 시드됩니다. 데이터는 브라우저 localStorage에 저장됩니다.

## 📁 구성

```
/
├── index.html            # 앱 진입점 (Pages 루트)
├── manifest.webmanifest  # PWA (홈화면 추가 → 앱처럼)
├── assets/style.css      # 파스텔·저채도 디자인 시스템
├── js/
│   ├── kpi.js            # ★ 가치 점수 모델 (Z-score → T-score)
│   ├── store.js          # 데이터 계층 (localStorage, DB 스키마와 1:1)
│   └── app.js            # 화면 라우팅 + 렌더링
├── docs/                 # 기획 본질/유저플로우/UI/기술/KPI/MVP 문서
└── .github/workflows/deploy-pages.yml
```

## 🎯 한 줄 본질

> **경기를 보며 탭한다 → 데이터가 쌓인다 → 가치 점수(레이더)로 본다.**

AI 분석·외부 연동·랭킹·구단 기능은 이 핵심 루프가 검증된 **후**에 붙는 확장입니다.
자세한 논리·설계는 [`docs/`](docs) 참고.

## 🧮 가치 점수 모델

로데이터 → **표준화(Z)** → **가중합** → **점수화(T=50+10Z)** 로 5개 KPI를 계산합니다.
기획서 예시(이승원 기회창출 44.7점)를 재현하도록 리그 기준값을 역산해 넣었습니다. → [`js/kpi.js`](js/kpi.js), [`docs/05-KPI-가치점수-모델.md`](docs/05-KPI-가치점수-모델.md)
