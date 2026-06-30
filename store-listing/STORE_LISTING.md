# PoopBuddy v2.4 Global Play Store Materials

## Release

- Package: `com.poopbuddy.app`
- Version: `2.4`
- Version code: `6`
- Track target: `production`
- Release name: `PoopBuddy 2.4 global polish`
- Locale SSOT: `config/play-locales.json`

## Primary Korean Listing

### App Name

PoopBuddy - 반려동물 배변기록

### Short Description

AI 사진 분석으로 반려동물 장건강 점수와 패턴을 확인하세요

### Full Description

PoopBuddy는 AI 기반 반려동물 장건강 체크 앱입니다.

강아지와 고양이의 대변 사진을 기록하고, 색상, 형태, 위험 신호를 정리해 장건강 점수와 관리 힌트를 제공합니다. 반복되는 이상 징후는 캘린더와 통계로 추적하고, 필요할 때 보호자 또는 수의사에게 공유할 수 있는 리포트로 정리할 수 있습니다.

주요 기능

- AI 사진 분석과 Bristol Type 참고
- 0-100점 장건강 점수
- 날짜별 캘린더와 주간 패턴 추적
- 수의사 상담 준비용 PDF/CSV 리포트
- 강아지/고양이 멀티펫 프로필
- 보호자 중심의 개인정보 관리

PoopBuddy의 분석 결과는 건강 참고용이며, 진단이나 치료를 대체하지 않습니다. 이상 징후가 반복되거나 심각한 증상이 있으면 수의사 상담을 권장합니다.

### Release Notes

v2.4 글로벌 스토어 개선

- 프리미엄 의료형 스토어 이미지 갱신
- 한국어, 영어, 일본어 대표 등록정보 정리
- 건강 점수, 캘린더, 수의사 공유 리포트 흐름 강화

## Locale Sets

- `ko-KR`: `store-listing/locales/ko-KR/STORE_LISTING.md`
- `en-US`: `store-listing/locales/en-US/STORE_LISTING.md`
- `ja-JP`: `store-listing/locales/ja-JP/STORE_LISTING.md`

## Upload Assets

- `feature-graphic-1024x500.png`
- `screenshot-1-home.png`
- `screenshot-2-analyze.png`
- `screenshot-3-calendar.png`
- `screenshot-4-stats.png`
- `screenshot-5-report.png`
- `screenshot-6-profiles.png`
- `screenshot-7-privacy.png`
- `screenshot-8-routine.png`

Locale-specific screenshots live under `store-listing/locales/<locale>/phone-screenshots/`.

## Required Verification

- Run `pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File scripts/render-store-assets.ps1`.
- Run `pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File scripts/verify-store-assets.ps1`.
- After Play upload, verify Play Console/API readback and public URLs for `KR/ko`, `US/en`, and `JP/ja`.
