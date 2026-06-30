# PoopBuddy v2.5 Widget Release Status

Date: 2026-06-30
Package: com.poopbuddy.app
Target track: production
Version: 2.5 / versionCode 7

## Local Implementation

Implemented Android home screen widgets:
- Quick Log 2x2: pee / poop / accident quick log buttons and today counts.
- Health Summary 4x2: today summary, last poop time, recent AI health score / Bristol type, quick actions.
- Native bridge: WidgetBridge syncWidgetState + consumePendingEvents between WebView localStorage and Android SharedPreferences.
- Locales: ko / en / ja widget labels and accessibility-facing strings.

## Validation Passed

- node --check index.js: PASS
- node --check www/index.js: PASS
- npx cap sync android: PASS
- android\gradlew.bat -p android testDebugUnitTest: PASS
- android\gradlew.bat -p android assembleDebug: PASS
- Real-device install on SM-S931N Android 16: PASS
- Widget provider registration readback: PASS
- Widget LOG_PEE / LOG_POO / LOG_ACCIDENT broadcast queue: PASS
- App resume pending-event consume: PASS
- WebView localStorage merge: PASS, 3 widget test events observed
- Test event cleanup and mirror reset: PASS, pending_events=[], counts=0/0/0
- android\gradlew.bat -p android bundleRelease: PASS
- android\gradlew.bat -p android lintDebug: PASS

## Release Artifact

AAB: C:\development\PoopBuddy\android\app\build\outputs\bundle\release\app-release.aab
SHA-256: BDE25CCB45A1C58340A4EE5634BC84C42D2360F28FC2980C4CACAF4237355A34
Size: 6,276,514 bytes

## Play Console Upload Attempt

Result: BLOCKED before final upload/submit.

Reason:
- Play Console repeatedly drifted from PoopBuddy app context to a different app context after release-create actions.
- Confirmed incorrect app context included package/help text for `me.bodeum.oilwidget` and app title `기름주의보 - 최저가 주유소`.
- Identity guard prevented uploading AAB to the wrong app.

Evidence files in this folder include:
- release-build.json
- play-console-production-before-upload.png
- play-console-production-releases-tab-attempt.png
- release-edit-before-aab-upload.png
- release-edit-after-aab-upload.png
- release-edit-filled-before-save.png
- release-edit-filled-with-delete-modal.png
- release-edit-after-aab-upload.txt
- release-edit-filled.txt
- release-notes-v25.txt

## Current Release State

Local release artifact is ready.
Google Play production upload is not completed.
Do not report this as uploaded or submitted.
Next safe step is to use Play Developer API credentials or have a human verify the Play Console app switcher stays on PoopBuddy before pressing release-create/upload controls.

## 2026-06-30 Upload Continuation

User requested closing browser windows and uploading from a clean automation browser.

Actions completed:
- Closed agbrowse Chrome and restarted with a single controlled tab.
- Re-entered PoopBuddy production track only after verifying app id `4973346914745048166` and app title `PoopBuddy - 반려동물 배변기록`.
- Found `versionCode 7` had already been consumed by Play artifact upload, so rebuilt release as `versionCode 8`, `versionName 2.5`.
- Uploaded AAB `versionCode 8 (2.5)` to the existing production draft.
- Removed stale failed `versionCode 7` upload chip from the draft.
- Verified Play Console draft summary: `PoopBuddy 2.5 home widgets`, `versionCode 8`, 177 countries/regions.
- Review screen readback showed `App bundle 8 (2.5)`, API 22+, target SDK 35, all ABI, 3/3 release note languages.
- Set rollout to 100% and saved.
- Publishing overview showed one production change: `PoopBuddy 2.5 home widgets`, `전체 출시 시작`.
- Clicked final confirmation `검토를 위해 변경사항 전송`.

Console status after final confirmation:
- `검토 중인 변경사항`
- Fast checks still running at readback time: `일반적으로 발견되는 문제에 대한 빠른 검사 실행 중`, max 8-9 minutes remaining.
- Console says changes will be sent for review immediately after quick checks pass.

Public URL readback:
- Public Google Play KR URL still shows previous approved listing, update date `2026. 6. 29.` and previous "전세계 출시 품질 개선" What’s new text.
- This is expected while Play review / quick checks / public cache are pending.
- Current state should be reported as: Console submitted/in review gate active; public URL not reflected yet.

Release artifact actually submitted:
- AAB: C:\development\PoopBuddy\android\app\build\outputs\bundle\release\app-release.aab
- versionCode: 8
- versionName: 2.5
- SHA-256: 4D12EAE5115A02928BFB960F65809EC1C2AA3F29324AEBC7DF5B419F6F76528E

Key evidence files:
- release-build-v8.json
- v8-after-remove-v7-error.txt/png
- safe-submit-after-next.txt/png
- review-after-save.txt/png
- publishing-overview-before-submit-v8.txt/png
- publishing-after-submit-click.txt/png
- publishing-after-confirm-submit.txt/png
- publishing-poll-00.txt/png
