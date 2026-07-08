# PoopBuddy 재부팅 재개 핸드오프

- 저장 시각: 2026-07-09 KST 업데이트
- 프로젝트 루트: `C:\development\PoopBuddy`
- 브랜치: `master`
- 원격: `origin https://github.com/misebear/poopbuddy.git`
- 목적: Codex 사이드바의 `PoopBuddy` 프로젝트를 재부팅 후 바로 이어갈 수 있게 현재 상태를 고정한다.

## 현재 상태 요약

- 최신 확인 기준 `git status -sb`: `## master...origin/master`
- 변경물이 많다. broad staging 금지.
  - 수정됨: `index.css`, `index.html`, `index.js`, `server.js`
  - runtime DB 파일 수정: `poopbuddy.db-shm`, `poopbuddy.db-wal`
  - 미추적: `DESIGN_LOCK.md`, `GROWTH_PLAN.md`, `runs/design_*`, `runs/growth_*`, `runs/play_*` 등 다수
- 기존 릴리스 handoff 기준으로는 v2.5 widget production 제출 후 공개 반영/검토 readback 대기 상태였다.
- 이 handoff는 재부팅 재개용 문서만 추가한다. runtime DB, Play evidence, 디자인 산출물은 건드리지 않았다.
- 2026-07-09 Search Console 수동 색인 요청 재확인 완료:
  - 대상 URL: `https://poopbuddy-landing.pages.dev/`
  - URL 상태: `URL이 Google에 등록되어 있음`
  - 페이지 상태: `페이지 색인이 생성됨`
  - 수동 요청 결과: `색인 생성 요청됨`
  - 할당량 초과: `false`
  - 메시지: `URL이 우선순위 크롤링 대기열에 추가되었습니다.`
  - 증거 JSON: `C:\development\PoopBuddy\runs\growth_launch_20260705\search-console-rerun-20260709-quota\quota-check-result.json`
  - 증거 스크린샷: `C:\development\PoopBuddy\runs\growth_launch_20260705\search-console-rerun-20260709-quota\after-request-modal.png`

## 먼저 읽을 파일

1. `C:\development\PoopBuddy\RESTART_HANDOFF_20260630_POOPBUDDY_WIDGET_V25.md`
2. `C:\development\PoopBuddy\WHAT_CAN_THIS_PROJECT_DO.md`
3. `C:\development\PoopBuddy\runs\play_widget_v25_20260630\POOPBUDDY_V25_WIDGET_STATUS.md`
4. `C:\development\PoopBuddy\runs\growth_launch_20260705\PLAY_PUBLIC_READBACK.md`
5. `C:\development\PoopBuddy\DESIGN_LOCK.md`가 존재하면 디자인 재개 시 함께 확인한다.
6. `C:\development\PoopBuddy\runs\growth_launch_20260705\search-console-rerun-20260709-quota\quota-check-result.json`

## 재개 첫 명령

```powershell
cd C:\development\PoopBuddy
git status --short --branch
Get-Content .\RESTART_HANDOFF_20260707_CODEX_SIDEBAR_SAVE.md
Get-Content .\runs\growth_launch_20260705\search-console-rerun-20260709-quota\quota-check-result.json
```

## 주의

- Play Console 상태, 공개 Play URL 반영, Search Console/IndexNow 등 외부 상태는 재부팅 후 직접 재확인해야 한다.
- Search Console은 2026-07-09 기준 수동 색인 요청 접수까지 완료됐다. 이후에는 검색 노출/순위/스니펫 반영을 별도로 확인하면 된다.
- `poopbuddy.db-shm` / `poopbuddy.db-wal` 같은 runtime 파일은 커밋 대상에서 제외한다.
- 커밋이 필요하면 handoff/문서/소스 변경을 좁게 stage한다.
