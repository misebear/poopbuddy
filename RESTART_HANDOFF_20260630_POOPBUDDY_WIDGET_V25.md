# PoopBuddy v2.5 위젯 릴리스 저장 / 재개 문서

- 저장 시각: 2026-06-30 KST
- 프로젝트 루트: `C:\development\PoopBuddy`
- 현재 목표: Android 홈 화면 위젯 추가, 실기기 검증, Google Play production 제출 후 공개 반영 대기
- 기준 상태 문서: `runs\play_widget_v25_20260630\POOPBUDDY_V25_WIDGET_STATUS.md`

## 현재 결론

- 위젯 구현과 실기기 검증은 완료.
- Google Play Console production에 `PoopBuddy 2.5 home widgets`를 제출 완료.
- 실제 제출 AAB는 `versionCode 8`, `versionName 2.5`.
- Console 최종 readback은 `검토 중인 변경사항`.
- 빠른 검사가 실행 중이었고, Console 문구상 빠른 검사 통과 즉시 Google 검토로 전송되는 상태.
- 공개 Play URL은 마지막 확인 기준 아직 이전 승인본 노출 중.

## 구현된 기능

- `Quick Log 2x2` Android 홈 화면 위젯
  - 소변, 대변, 실수 빠른 기록
  - 오늘 기록 카운트 표시
- `Health Summary 4x2` Android 홈 화면 위젯
  - 오늘 요약
  - 마지막 대변 시간
  - 최근 AI 건강 점수 / Bristol 타입
  - 캘린더 열기 및 빠른 기록
- WebView `localStorage`와 Android `SharedPreferences` 간 브리지
  - `WidgetBridge.syncWidgetState(payload)`
  - `WidgetBridge.consumePendingEvents()`
  - 위젯 버튼 입력은 pending event로 저장 후 앱 재개 시 `pb-potty-logs`에 병합
- Android widget 문자열은 `values`, `values-ko`, `values-ja`에 반영.

## 주요 변경 파일

- `android\app\build.gradle`
  - `versionCode 8`, `versionName 2.5`
  - release signing secret을 `keystore.properties` 또는 환경변수로 분리
- `android\app\src\main\AndroidManifest.xml`
  - `QuickLogWidgetProvider`, `HealthSummaryWidgetProvider` receiver 등록
- `android\app\src\main\java\com\poopbuddy\app\MainActivity.java`
  - `WidgetBridgePlugin` 등록
  - 위젯 deep link / page launch 처리
- `android\app\src\main\java\com\poopbuddy\app\*Widget*.java`
  - 위젯 상태 저장, RemoteViews 업데이트, Broadcast 처리, Capacitor plugin bridge
- `android\app\src\main\res\layout\widget_*.xml`
- `android\app\src\main\res\xml\widget_*_info.xml`
- `android\app\src\main\res\drawable\widget_*.xml`
- `index.js`
  - 위젯 state sync / pending event consume / localStorage 병합
- `sw.js`
  - WebView 캐시 이름 `poopbuddy-v6-widget`
- `runs\play_widget_v25_20260630\POOPBUDDY_V25_WIDGET_STATUS.md`
  - 검증, 업로드, 제출 상태 기록

## 검증 완료

- `node --check index.js`: PASS
- `node --check www\index.js`: PASS
- `npx cap sync android`: PASS
- `android\gradlew.bat -p android testDebugUnitTest`: PASS
- `android\gradlew.bat -p android assembleDebug`: PASS
- 실기기 설치: `SM-S931N`, Android 16, PASS
- 위젯 provider 등록 readback: PASS
- 위젯 Broadcast:
  - `LOG_PEE`: PASS
  - `LOG_POO`: PASS
  - `LOG_ACCIDENT`: PASS
- 앱 재개 후 pending event consume: PASS
- WebView localStorage 병합 확인: PASS
- 테스트 이벤트 cleanup 후 mirror reset: PASS
- `android\gradlew.bat -p android bundleRelease`: PASS
- `android\gradlew.bat -p android lintDebug`: PASS

## 제출 산출물

- AAB: `C:\development\PoopBuddy\android\app\build\outputs\bundle\release\app-release.aab`
- package: `com.poopbuddy.app`
- versionCode: `8`
- versionName: `2.5`
- SHA-256: `4D12EAE5115A02928BFB960F65809EC1C2AA3F29324AEBC7DF5B419F6F76528E`
- release name: `PoopBuddy 2.5 home widgets`
- release notes locale: `ko-KR`, `en-US`, `ja-JP`
- production rollout: `100%`

## Play Console 상태

확인된 순서:

1. 기존 `versionCode 7`은 Play artifact library에서 이미 사용되어 재업로드 거절.
2. `versionCode 8`로 재빌드.
3. production draft에 `App bundle 8 (2.5)` 업로드.
4. stale `versionCode 7` 실패 chip 제거.
5. release review 화면에서 `App bundle 8 (2.5)` readback 확인.
6. rollout `100%` 저장.
7. Publishing overview에서 production 변경사항 1개 확인.
8. `검토를 위해 변경사항 전송` 최종 클릭.
9. 최종 readback: `검토 중인 변경사항`, 빠른 검사 실행 중.

## 공개 URL 상태

마지막 확인 기준 공개 URL은 아직 이전 승인본이다.

- `https://play.google.com/store/apps/details?id=com.poopbuddy.app&gl=KR&hl=ko`
- 현재 표시: 2026-06-29 업데이트 / 이전 v2.4 문구
- 해석: Console 제출 완료, 공개 노출 대기

## 재개 순서

1. `runs\play_widget_v25_20260630\POOPBUDDY_V25_WIDGET_STATUS.md`를 먼저 연다.
2. Play Console publishing overview를 확인한다.
3. 상태가 아직 빠른 검사 중이면 5-10분 단위로 재확인한다.
4. 상태가 Google review 중이면 “Console 제출 완료, 공개 노출 대기”로 유지한다.
5. 승인 후 아래 공개 URL matrix를 캡처한다.
   - `gl=KR&hl=ko`
   - `gl=US&hl=en`
   - `gl=JP&hl=ja`
6. 공개 URL에 위젯 릴리스 노트나 업데이트 날짜가 반영되면 상태 문서를 `public reflected`로 갱신한다.

## 주의할 점

- Play Console 자동화 중 다른 앱/외부 페이지로 drift가 반복됐다. 반드시 URL app id `4973346914745048166`과 화면 앱명 `PoopBuddy - 반려동물 배변기록`을 동시에 검증한다.
- `poopbuddy.db-shm`, `poopbuddy.db-wal`은 런타임 DB 파일이므로 stage 하지 않는다.
- `runs\play_widget_v25_20260630`의 PNG evidence는 로컬 증거로 유용하지만 커밋에는 필수 아님.
- 공개 페이지 반영은 Play review/cache/CDN 지연이 있으므로 Console 상태와 public URL 상태를 분리 보고한다.
