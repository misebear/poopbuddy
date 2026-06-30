# PoopBuddy 재부팅 후 이어가기 저장

- 저장 시각: 2026-06-29 KST
- Codex thread: `019f106c-dc0a-7822-94ed-19deef4626a8`
- 프로젝트 루트: `C:\development\PoopBuddy`
- 현재 목표: PoopBuddy v2.4 전세계 Play production 제출 후 공개 반영 확인.

## 현재 상태

- Play Console production 제출 완료.
- 현재 상태: Google Play `검토 중인 변경사항`.
- 공개 URL `KR/ko`, `US/en`, `JP/ja`는 마지막 확인 기준 이전 승인본 노출 중.
- 자동 확인: `PoopBuddy v2.4 공개 반영 확인`, 2시간마다 약 48시간 확인하도록 설정된 것으로 기록됨.
- 상태 문서: `C:\development\PoopBuddy\runs\play_global_v24_20260629\POOPBUDDY_V24_STATUS.md`
- 재개 문서: `C:\development\PoopBuddy\RESTART_HANDOFF_20260629_POOPBUDDY_V24.md`

## 제출/산출물

- AAB: `C:\development\PoopBuddy\android\app\build\outputs\bundle\release\app-release.aab`
- versionCode/versionName: `6 / 2.4`
- SHA-256: `E6BA076BA396B65AAB695C94A2E47E93F2797964646A69D61C090D7260EFBCDC`
- locale: `ko-KR`, `en-US`, `ja-JP`
- Play listing: feature graphic 1/1, phone screenshots 8/8 기준으로 제출.

## 최근 검증

- `node --check index.js`: PASS
- `scripts\verify-store-assets.ps1`: PASS, 3 locales
- 이전 실행 기준 `npx cap sync android`, `testDebugUnitTest`, `bundleRelease`: PASS

## 주의할 점

- git working tree는 v2.4 변경과 DB WAL/SHM, runs 산출물이 섞인 dirty 상태다.
- 재부팅 저장 단계에서는 커밋/푸시하지 않았다.
- `poopbuddy.db-shm`, `poopbuddy.db-wal` 같은 런타임 파일은 stage 대상에서 제외해야 한다.

## 재개 순서

1. `RESTART_HANDOFF_20260629_POOPBUDDY_V24.md`와 `POOPBUDDY_V24_STATUS.md` 먼저 열기.
2. Play Console publishing overview 확인.
3. 공개 URL matrix 확인:
   - `https://play.google.com/store/apps/details?id=com.poopbuddy.app&gl=KR&hl=ko`
   - `https://play.google.com/store/apps/details?id=com.poopbuddy.app&gl=US&hl=en`
   - `https://play.google.com/store/apps/details?id=com.poopbuddy.app&gl=JP&hl=ja`
4. 공개 반영 완료 시 상태 문서를 `public reflected`로 갱신.
