# PoopBuddy 저장 / 재시작 Handoff

작성일: 2026-06-28

## 한 줄 상태

PoopBuddy 디자인 개선, GPT 이미지 기반 스토어 그래픽 제작, Android `2.3` release AAB 빌드, Play Console 프로덕션 릴리스/스토어 이미지 반영까지 완료했다.

## 바로 확인할 파일

- 업로드 완료 보고서: `C:\development\PoopBuddy\runs\design_audit_20260628\POOPBUDDY_UPLOAD_STATUS_20260628.md`
- AAB: `C:\development\PoopBuddy\android\app\build\outputs\bundle\release\app-release.aab`
- 피처 그래픽: `C:\development\PoopBuddy\store-listing\feature-graphic-1024x500.png`
- GPT 원본 이미지: `C:\development\PoopBuddy\store-listing\gpt-feature-original.png`
- 스토어 스크린샷:
  - `C:\development\PoopBuddy\store-listing\screenshot-1-home.png`
  - `C:\development\PoopBuddy\store-listing\screenshot-2-analyze.png`
  - `C:\development\PoopBuddy\store-listing\screenshot-3-stats.png`
  - `C:\development\PoopBuddy\store-listing\screenshot-4-calendar.png`
  - `C:\development\PoopBuddy\store-listing\screenshot-5-more.png`

## Play Console 상태

- 앱: `PoopBuddy - 반려동물 배변기록`
- 패키지: `com.poopbuddy.app`
- Play Console app id: `4973346914745048166`
- 프로덕션 릴리스: `PoopBuddy 2.3 polish`
- AAB 버전: `versionCode 5`, `versionName 2.3`
- 게시 개요에서 확인한 최종 문구:
  - `최근 게시일: 2026년 6월 28일`
  - `앱 업데이트가 게시되었습니다. 변경사항이 사용자에게 즉시 표시되지만 시간이 더 걸릴 수도 있습니다.`
- 관리형 게시: 사용 중지됨

## 구현 변경 요약

- `index.js`: 데모/스토어 스크린샷용 URL 파라미터, deterministic demo data, 홈/분석/통계 화면 개선 로직 추가
- `index.css`: 경쟁 앱 대비 더 세련된 polish 스타일, 카드/내비/업로드/통계/광고 placeholder 정리
- `index.html`: splash 문구 및 표시 시간 조정
- `android/app/build.gradle`: `versionCode 5`, `versionName "2.3"`
- `store-listing/*`: Play 등록정보용 피처 그래픽과 스크린샷 갱신

## 검증 완료

- `node --check index.js`: 통과
- `npx cap sync android`: 통과
- `android\gradlew.bat bundleRelease`: 통과
- Play Console에서 `com.poopbuddy.app`, app id `4973346914745048166` 확인
- Play Console에서 스토어 그래픽 `1/1`, 휴대전화 스크린샷 `5/8` 저장 확인

## 현재 git 상태 메모

저장 시점에 commit/stage는 하지 않았다. `git status --short` 기준 주요 변경:

```text
 M android/app/build.gradle
 M index.css
 M index.html
 M index.js
 M poopbuddy.db-shm
 M store-listing/STORE_LISTING.md
 M store-listing/feature-graphic-1024x500.png
 M store-listing/screenshot-1-home.png
 M store-listing/screenshot-2-analyze.png
 M store-listing/screenshot-3-feed.png
 M store-listing/screenshot-4-calendar.png
 M store-listing/screenshot-5-worldmap.png
?? ADMOB_AUDIT.md
?? runs/
?? store-listing/gpt-feature-original.png
?? store-listing/screenshot-3-stats.png
?? store-listing/screenshot-5-more.png
```

`ADMOB_AUDIT.md`는 이번 작업 전부터 존재하던 미추적 파일로 보였으므로 건드리지 않았다.

## 다음에 이어서 할 일

1. 공개 Play 스토어 페이지에서 새 이미지와 버전이 실제 사용자 화면에 반영됐는지 확인한다.
2. 필요하면 `poopbuddy.db-shm` 같은 런타임 DB 파일을 commit 대상에서 제외할지 정리한다.
3. 서명 정보가 `android/app/build.gradle`에 직접 들어가 있으므로, 다음 보안 정리 때 환경변수 또는 `keystore.properties`로 이동한다.
4. 실기기 검증은 기존 설치본 서명 충돌 때문에 막혔다. 사용자 허용이 있을 때만 기존 앱을 uninstall 후 fresh install로 확인한다.
