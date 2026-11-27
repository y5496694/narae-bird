# 나래온 최신 다운로드 · 나래온 리모트

[![다운로드 문서 자동 갱신](https://github.com/y5496694/narae-bird/actions/workflows/sync-downloads.yml/badge.svg)](https://github.com/y5496694/narae-bird/actions/workflows/sync-downloads.yml)

> `ops/sync-downloads.py`가 **기존 에이두 앱스토어**의 정확한 패키지 `com.aiedue.naraeon`를 조회해 생성하는 문서입니다. APK를 이 저장소에 복제 배포하지 않습니다.

## 나래온 APK

- **[나래온 최신 APK 다운로드](https://aiedue.ddns.net/db-cloud/shr_naraeon_routing72_eb929790e9b4522d/download)**
- [스토어 상세·설치 안내](https://aiedue.ddns.net/appstore/apps/naraeon/1.1.16-local.72/)
- 패키지: `com.aiedue.naraeon`
- 스토어 등록 버전: **1.1.16-local.72** (`versionCode: 428373`)
- 스토어 등록 최소 Android: **API 29 이상**, ABI: **arm64-v8a**
- 등록 파일 크기: **361,729,072바이트**
- 스토어 등록 SHA-256: `eb929790e9b4522d88f6857a65520737660a155d83379611355ca7fe0a303910`

위 크기·해시는 스토어의 배포 메타데이터입니다. 이 문서를 갱신하는 과정에서 APK 전체를 다시 내려받아 검증하거나 실기기에 설치하지는 않습니다.

## 자동 반영 방식

- GitHub Actions가 **매시간** 스토어 카탈로그를 조회하고 버전·APK 주소·상세 주소·최소 API·ABI·등록 크기·해시가 달라지면 이 문서를 자동 커밋합니다.
- 즉시 확인하려면 **[나래온 다운로드 페이지](https://aiedue.ddns.net/naraeon/#downloads)** 또는 **[에이두 앱스토어](https://aiedue.ddns.net/appstore/)**를 여세요. 나래온 페이지는 열 때 스토어 카탈로그를 조회합니다. 조회 실패 안내가 보이면 최신 확인에 성공한 것이 아닙니다.
- 저장소 문서는 **스토어 게시와 동시에 바뀌는 실시간 링크가 아니라 예약 갱신 결과**입니다. GitHub 예약 실행은 지연될 수 있으며, 실행 장애 시 마지막 성공 문서가 남습니다. 위 배지에서 실제 실행 상태를 확인하세요.
- 정상 카탈로그에서 나래온 배포가 제거되면 다운로드를 제거합니다. 카탈로그 조회·검증 실패 시 문서를 덮어쓰지 않고 워크플로를 실패로 표시합니다.
- 수동 갱신: Actions → **Sync latest NaraeOn downloads** → **Run workflow**. 또는 저장소 루트에서 `python ops/sync-downloads.py`.
- 공개 저장소의 예약 실행은 장기간 저장소 활동이 없으면 GitHub 정책에 따라 중지될 수 있습니다. Actions에서 다시 활성화하세요. 별도 스토어 계정·API 키·기기 토큰은 필요하지 않습니다.

## 나래온 리모트 (PC)

나래온이 설치된 **휴대폰·태블릿을 PC에서 원격 제어하여 조종**하는 도구입니다. 기기의 기존 HTTPS MCP 연결로 화면을 확인하고 터치·입력·홈·뒤로·스크롤을 수행합니다. 서버를 실행하는 Termux 화면도 기기에서 허용한 뒤 조작할 수 있습니다.

- **[최신 나래온 리모트 받기](https://github.com/y5496694/remote-naraeon-cli/releases/latest)** — 공식 GitHub의 최신 릴리스로 연결하므로 릴리스 버전이 바뀌어도 이 링크는 같습니다.
- [공식 소스·전체 사용 안내](https://github.com/y5496694/remote-naraeon-cli)
- 이 저장소에 포함된 소스 경로: `remote/naraeon` ([공식 저장소](https://github.com/y5496694/remote-naraeon-cli)의 Git 하위 모듈, 검토한 커밋으로 고정).
- [폰·태블릿 서버 운영 및 리모트 연결 순서](android-server.md)

PC 도구는 APK 전용 에이두 스토어에 넣지 않습니다. 리모트 소스 하위 모듈은 APK 문서 갱신에 따라 임의로 변경하지 않습니다. 최신 소스가 필요하면 공식 변경 내용을 확인한 뒤 하위 모듈을 갱신·커밋하세요.

## F-Droid · Termux

- [F-Droid 공식 사이트·설치 APK](https://f-droid.org/ko/)
- [F-Droid의 Termux 공식 패키지](https://f-droid.org/ko/packages/com.termux/)
- **폰·태블릿 서버 운영은 F-Droid에서 설치한 Termux의 최신 안정판을 권장합니다.** 베타 번호나 APK 파일명을 고정하지 않고 F-Droid 앱에서 권장되는 안정판을 선택하세요.
- [F-Droid → Termux 설치 → PC 배포 → 도메인 공개 안내](android-server.md)

[나래 버드 README로 돌아가기](../README.md)
