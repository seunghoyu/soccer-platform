#!/usr/bin/env bash
# 새 public 저장소 생성 + 푸시 + Pages 자동 배포
# 사전: gh CLI 설치 & 로그인 (gh auth login)
set -e

REPO="youth-soccer-data-platform"

git init -q
git add .
git commit -qm "init: 유소년 축구 데이터 플랫폼 Pilot" || true
git branch -M main

# gh 로그인 계정에 public 레포 생성 + origin 연결 + 푸시
gh repo create "$REPO" --public --source=. --remote=origin --push

# Pages 소스를 GitHub Actions로 설정 (한 번만)
gh api -X POST "repos/{owner}/$REPO/pages" -f build_type=workflow 2>/dev/null \
  || gh api -X PUT "repos/{owner}/$REPO/pages" -f build_type=workflow 2>/dev/null \
  || echo "※ Pages가 자동 설정되지 않으면: 저장소 Settings → Pages → Source: GitHub Actions 선택"

USER=$(gh api user -q .login)
echo ""
echo "✅ 완료. 1~2분 뒤 Actions 배포가 끝나면:"
echo "   https://$USER.github.io/$REPO/"
