# PoopBuddy 프로젝트로 할 수 있는 것

PoopBuddy는 반려동물 배변 기록, AI 기반 변 상태 분석, 캘린더/통계 기록, 커뮤니티 흐름, Google Play 출시 산출물을 포함한 Android Capacitor 앱이다.

## 바로 할 수 있는 작업

- Android 앱 빌드 및 release AAB 생성
- Google Play production 제출 준비 및 상태 readback
- 홈 화면 위젯 동작 검증
- 한국어/영어/일본어 앱 문자열과 Play listing 산출물 관리
- 스토어 스크린샷/feature graphic 검증
- 실기기 ADB 설치 및 WebView localStorage 검증

## 주요 실행 명령

```powershell
node --check index.js
node --check www\index.js
npx cap sync android
android\gradlew.bat -p android testDebugUnitTest
android\gradlew.bat -p android assembleDebug
android\gradlew.bat -p android bundleRelease
android\gradlew.bat -p android lintDebug
```

## Android 실기기 확인

기본 ADB 경로:

```powershell
C:\Users\db019\AppData\Local\Android\Sdk\platform-tools\adb.exe
```

최근 검증 기기:

- 모델: `SM-S931N`
- Android: `16`

## Google Play 출시 상태

최근 저장 기준:

- package: `com.poopbuddy.app`
- production release: `PoopBuddy 2.5 home widgets`
- versionCode/versionName: `8 / 2.5`
- 상태: Console 제출 완료, 공개 URL 반영 대기
- 기준 문서: `RESTART_HANDOFF_20260630_POOPBUDDY_WIDGET_V25.md`

## 건드리면 안 되는 항목

- `.env`, 브라우저 세션, Play Console 쿠키, token, API key는 커밋하거나 외부 프롬프트에 넣지 않는다.
- `poopbuddy.db-shm`, `poopbuddy.db-wal`은 런타임 파일이므로 stage 하지 않는다.
- Play Console 작업 시 다른 앱으로 context drift가 생길 수 있으므로 앱 ID와 앱명을 동시에 검증한다.
