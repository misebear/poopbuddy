# PoopBuddy v2.4 재개 Handoff

작성일: 2026-06-29

## 한 줄 상태

PoopBuddy v2.4 글로벌 polish 로컬 구현/빌드/스토어 자산 생성/Play Console production 제출 완료. 현재는 Google Play `검토 중인 변경사항` 상태이며 공개 URL은 이전 승인본 노출 중이라 `공개 반영 대기`.

## 가장 먼저 열 파일

- 상세 상태: `C:\development\PoopBuddy\runs\play_global_v24_20260629\POOPBUDDY_V24_STATUS.md`
- Locale SSOT: `C:\development\PoopBuddy\config\play-locales.json`
- AAB: `C:\development\PoopBuddy\android\app\build\outputs\bundle\release\app-release.aab`

## 검증된 명령

```powershell
node --check index.js
pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File scripts\verify-store-assets.ps1
npx cap sync android
android\gradlew.bat -p android testDebugUnitTest
android\gradlew.bat -p android bundleRelease
```

## Play Console 재개

1. PoopBuddy publishing overview로 이동:

```text
https://play.google.com/console/u/0/developers/5047399025850753041/app/4973346914745048166/publishing
```

2. 현재 상태가 `검토 중인 변경사항`인지 확인한다.
3. 제출된 변경 묶음:

```text
프로덕션: PoopBuddy 2.4 global polish / 전체 출시 시작
스토어 등록정보: en-US 언어 추가
스토어 등록정보: ja-JP 언어 추가
스토어 등록정보: ko-KR 짧은 설명/전체 설명/phone screenshots/feature graphic 변경
```

4. 승인/게시 후 공개 URL matrix를 다시 확인한다:

```text
https://play.google.com/store/apps/details?id=com.poopbuddy.app&gl=KR&hl=ko
https://play.google.com/store/apps/details?id=com.poopbuddy.app&gl=US&hl=en
https://play.google.com/store/apps/details?id=com.poopbuddy.app&gl=JP&hl=ja
```

5. 공개 URL이 v2.4 문구/이미지를 보이면 `runs\play_global_v24_20260629\POOPBUDDY_V24_STATUS.md`를 `public reflected`로 갱신한다.

## 최신 Evidence

- Play final poll: `C:\development\PoopBuddy\runs\play_global_v24_20260629\play-console-publishing-overview-final-poll.json`
- Play final screenshot: `C:\development\PoopBuddy\runs\play_global_v24_20260629\play-console-publishing-overview-final-poll.png`
- Public URL readback: `C:\development\PoopBuddy\runs\play_global_v24_20260629\public-url\public-url-after-submit-readback.json`
- Public URL screenshots:
  - `C:\development\PoopBuddy\runs\play_global_v24_20260629\public-url\public_after_submit_KR_ko.png`
  - `C:\development\PoopBuddy\runs\play_global_v24_20260629\public-url\public_after_submit_US_en.png`
  - `C:\development\PoopBuddy\runs\play_global_v24_20260629\public-url\public_after_submit_JP_ja.png`

## 절대 주의

- Play Console이 다른 앱으로 드리프트할 수 있다. 버튼 클릭 전 항상 앱명 `PoopBuddy - 반려동물 배변기록`과 URL app id `4973346914745048166`을 확인한다.
- `poopbuddy.db-shm`, `poopbuddy.db-wal`, `android/keystore.properties`는 stage하지 않는다.
