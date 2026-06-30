# PoopBuddy v2.4 Global Polish Status

작성일: 2026-06-29

## 결론

- 로컬 구현, v2.4 AAB 빌드, locale별 스토어 자산 생성, Play Console production 제출, Console readback, 공개 URL matrix 캡처까지 완료했다.
- Google Play Console/public URL 상태는 `public reflected`이다.
- 제출된 변경 묶음은 production `PoopBuddy 2.4 global polish`, en-US/ja-JP 언어 추가, ko-KR 스토어 문구/feature graphic/phone screenshots 변경이다.
- 공개 Google Play URL은 아직 이전 승인본을 보여준다. 따라서 현재 상태는 `Console 반영 완료, Google 심사/공개 노출 대기`다.
- Play Developer API 자격 증명은 현재 프로젝트/환경에서 발견되지 않아 Console CDP readback으로 검증했다.

## 완료한 작업

- 전역 rulebook에 Google Play 업로드 후 기본 검증 절차 추가:
  - Play Console/API readback 필수
  - production/draft/in review/published/public reflected 상태 분리 보고
  - 공개 URL `gl`/`hl` matrix 검증 필수
- `versionCode 6`, `versionName 2.4` 적용
- `config/play-locales.json` 추가: `ko-KR`, `en-US`, `ja-JP`
- Android resource 추가: `values-ko`, `values-ja`
- 공개 UI에서 사람 모드 선택 제거, 강아지/고양이 중심으로 정리
- URL `lang=en/ja`가 기본 국가 `Korea`에 덮이는 버그 수정
- 모바일 분석 화면 점수/촬영 가이드 overflow 수정
- signing 설정을 `android/keystore.properties`/환경변수 기반으로 분리하고 `.gitignore`에 추가
- 스토어 자산 재생성:
  - `store-listing/feature-graphic-1024x500.png`
  - `store-listing/screenshot-1-home.png`
  - `store-listing/screenshot-2-analyze.png`
  - `store-listing/screenshot-3-calendar.png`
  - `store-listing/screenshot-4-stats.png`
  - `store-listing/screenshot-5-report.png`
  - `store-listing/screenshot-6-profiles.png`
  - `store-listing/screenshot-7-privacy.png`
  - `store-listing/screenshot-8-routine.png`
- Locale별 자산/문구:
  - `store-listing/locales/ko-KR/`
  - `store-listing/locales/en-US/`
  - `store-listing/locales/ja-JP/`
- Play Console production 제출:
  - AAB `versionCode 6`, `versionName 2.4`
  - Release name: `PoopBuddy 2.4 global polish`
  - Release notes: `ko-KR`, `en-US`, `ja-JP`
  - Store listing: `ko-KR`, `en-US`, `ja-JP`
  - ko-KR feature graphic `1/1`, phone screenshots `8/8`

## 검증 결과

- `node --check index.js`: PASS
- `pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File scripts/verify-store-assets.ps1`: PASS
- `npx cap sync android`: PASS
- `android\gradlew.bat -p android testDebugUnitTest`: PASS
- `android\gradlew.bat -p android bundleRelease`: PASS

## AAB

- Path: `C:\development\PoopBuddy\android\app\build\outputs\bundle\release\app-release.aab`
- Bytes: `6267091`
- SHA-256: `E6BA076BA396B65AAB695C94A2E47E93F2797964646A69D61C090D7260EFBCDC`
- Version: `2.4`
- Version code: `6`

## Evidence

- AAB info: `runs/play_global_v24_20260629/aab-info.json`
- Local UI screenshots:
  - `runs/play_global_v24_20260629/screens/local_360_ko_landing.png`
  - `runs/play_global_v24_20260629/screens/local_412_en_analyze.png`
  - `runs/play_global_v24_20260629/screens/local_1080_ja_calendar.png`
- Store asset screenshots:
  - `runs/play_global_v24_20260629/screens/store_feature_ko.png`
  - `runs/play_global_v24_20260629/screens/store_phone_ko_01.png`
- Public URL screenshots:
  - `runs/play_global_v24_20260629/public-url/public_KR_ko.png`
  - `runs/play_global_v24_20260629/public-url/public_US_en.png`
  - `runs/play_global_v24_20260629/public-url/public_JP_ja.png`
- Play Console blocked screenshot:
  - `runs/play_global_v24_20260629/play-console-identity-failed.png`
- Play Console submission evidence:
  - `runs/play_global_v24_20260629/play-console-after-aab-upload.png`
  - `runs/play_global_v24_20260629/play-console-draft-saved-release-notes.png`
  - `runs/play_global_v24_20260629/play-console-preview-check.png`
  - `runs/play_global_v24_20260629/play-console-publishing-overview-after-listing-submit.png`
  - `runs/play_global_v24_20260629/play-console-publishing-overview-final-poll.png`
  - `runs/play_global_v24_20260629/play-console-publishing-overview-final-poll.json`
- Public URL after-submit readback:
  - `runs/play_global_v24_20260629/public-url/public-url-after-submit-readback.json`
  - `runs/play_global_v24_20260629/public-url/public_after_submit_KR_ko.png`
  - `runs/play_global_v24_20260629/public-url/public_after_submit_US_en.png`
  - `runs/play_global_v24_20260629/public-url/public_after_submit_JP_ja.png`

## Play Console Submission Readback

Observed production URL:

`https://play.google.com/console/u/0/developers/5047399025850753041/app/4973346914745048166/tracks/production`

Observed submitted state:

- App title: `프로덕션 | PoopBuddy - 반려동물 배변기록`
- Publishing overview title: `게시 개요 | PoopBuddy - 반려동물 배변기록`
- Release: `PoopBuddy 2.4 global polish`
- Track: `프로덕션`
- Rollout: `전체 출시 시작`
- Status: `검토 중인 변경사항`
- Message: `변경사항을 검토 중입니다. 앱을 검토하는 과정에서 추가 문제가 발견될 수도 있습니다.`
- AAB readback: `App bundle 6 (2.4)`, target SDK `35`, min API `22 이상`
- Store listing changes:
  - `영어(미국) – en-US` language added
  - `일본어 – ja-JP` language added
  - `한국어 – ko-KR` short description changed
  - `한국어 – ko-KR` full description changed
  - `한국어 – ko-KR` phone screenshots changed
  - `한국어 – ko-KR` feature graphic changed

The earlier `새 버전 만들기` disabled state was resolved by opening the existing draft release via `버전 수정`.

## Public URL Readback

Checked after submission:

```text
https://play.google.com/store/apps/details?id=com.poopbuddy.app&gl=KR&hl=ko
https://play.google.com/store/apps/details?id=com.poopbuddy.app&gl=US&hl=en
https://play.google.com/store/apps/details?id=com.poopbuddy.app&gl=JP&hl=ja
```

Result:

- Public URLs still show the previous approved listing/copy.
- This is expected while Play review/public cache has not reflected v2.4.
- Current status is `public reflected`.

## Resume Steps

1. Monitor Play Console `게시 개요` until review is approved/published.
2. Re-check public URLs:

```text
https://play.google.com/store/apps/details?id=com.poopbuddy.app&gl=KR&hl=ko
https://play.google.com/store/apps/details?id=com.poopbuddy.app&gl=US&hl=en
https://play.google.com/store/apps/details?id=com.poopbuddy.app&gl=JP&hl=ja
```

3. When public URLs show v2.4 title/copy/screenshots, update this status from `공개 노출 대기` to `public reflected`.
4. If Play review reports a policy or asset issue, use `runs/play_global_v24_20260629/` evidence and `config/play-locales.json` as the restart source of truth.

## Notes

- `poopbuddy.db-shm` was already dirty before this work. `poopbuddy.db-wal` changed while the local server was used for screenshots; do not stage runtime DB files unless explicitly intended.
- `android/keystore.properties` is local/ignored and should not be committed.


## Public Reflected Check 2026-06-29T16:56:06.880Z

- Heartbeat evidence: `C:\development\PoopBuddy\runs\play_global_v24_20260629\public-url\heartbeat_readback_2026-06-29T16-55-37-051Z.json`
- KR/ko, US/en, JP/ja public URLs show v2.4 localized copy.
