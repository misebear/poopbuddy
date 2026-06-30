# PoopBuddy AdMob Audit - 2026-06-04

## Status

- Package: `com.poopbuddy.app`
- AdMob App ID: `ca-app-pub-9072876824288260~7058634144`
- Banner: `ca-app-pub-9072876824288260/8677568654`
- Interstitial: `ca-app-pub-9072876824288260/4803888663`
- AdMob state: 준비됨
- Current metrics: 요청 286, 노출 74

## Finding

- 로컬 manifest, Capacitor config, native banner 코드가 실제 PoopBuddy AdMob App ID와 banner ID를 사용한다.
- 광고 요청과 노출이 이미 발생 중이므로 기본 연결은 정상이다.

## Next

- 분석 완료/저장 같은 자연스러운 지점에서 interstitial 사용 여부를 점검한다.
- 사용자 불편을 늘리지 않는 범위에서 배너 위치, 노출 빈도, 로드 실패 로그를 개선한다.
