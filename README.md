# 나래 버드 · 도메인

[![검증](https://github.com/y5496694/narae-bird-domain/actions/workflows/verify.yml/badge.svg)](https://github.com/y5496694/narae-bird-domain/actions/workflows/verify.yml)

브라우저·PC·Termux 사이의 **실시간 파일 전송**과 **경로 기반 사이트 관리·로컬 HTTP/API 연결**을 제공하는 독립 서버입니다.

- **나래 버드**: 같은 관리자 계정의 기기 간 파일 스트리밍. 파일 본문은 서버 디스크에 보관하지 않습니다.
- **도메인**: `https://example.com/my-site` 형태의 경로 주소를 생성·수정·공개·삭제합니다. DNS 하위 도메인을 만드는 기능은 아닙니다.
- **커넥터**: 기기가 게이트웨이로 WSS 연결을 열어 로컬 `127.0.0.1:포트`의 HTTP/API를 공개합니다.
- **계정 분리**: 사이트·기기·파일 전송의 소유권, 관리자 세션·CSRF, 수정 충돌 검사.

운영 서비스: [도메인](https://aiedue.ddns.net/domain) · [버드](https://aiedue.ddns.net/bird)

## 요구 사항

- Node.js **24 이상** (`node:sqlite` 사용)
- Python **3.11 이상** (CLI·초기 관리자 생성·운영 보조 도구)
- 외부 서비스에는 HTTPS/WSS를 제공하는 리버스 프록시

이 저장소에는 소스·테스트·실행 문서만 포함하며 운영 계정, 세션, DB, 인증 파일은 포함하지 않습니다. `package.json`의 `private: true`는 실수로 npm에 배포하는 것을 막는 설정이며 GitHub 저장소 공개 여부와는 무관합니다.

## 로컬에서 시작

```sh
git clone https://github.com/y5496694/narae-bird-domain.git
cd narae-bird-domain
npm ci --ignore-scripts
python -m pip install -r requirements.txt

# 아이디·비밀번호는 대화형 입력. 기본 관리자나 기본 비밀번호는 없습니다.
python ops/create-admin.py

# Bash / Termux / Git Bash
APP_ORIGIN=http://127.0.0.1:3099 npm start
```

- 브라우저: `http://127.0.0.1:3099/domain` 또는 `http://127.0.0.1:3099/bird`
- 기본 DB: 저장소의 `data/admin.sqlite` (Git 제외)
- 기본 바인딩: `127.0.0.1:3099`
- 관리자 아이디는 소문자로 저장됩니다. 기존 아이디가 있으면 덮어쓰지 않습니다.
- 비밀번호는 12자 이상 입력하며 해시로 저장합니다. 비밀번호를 명령 인자·URL·소스에 넣지 마세요.
- 사용자 지정 `DATA_DIR`을 쓰면 관리자 생성과 서버 실행 모두 같은 값으로 설정해야 합니다.

PowerShell에서는 환경 변수를 별도로 설정합니다.

```powershell
$env:APP_ORIGIN = 'http://127.0.0.1:3099'
npm start
```

`APP_ORIGIN`은 브라우저에서 여는 주소와 정확히 일치해야 합니다. 외부 운영 시 실제 HTTPS origin으로 지정하세요. 서버는 `.env`를 자동으로 읽지 않으므로 환경 변수는 셸·서비스 관리자에서 전달해야 합니다.

## 웹 사용

1. 관리자 로그인 → 새 주소 만들기 → 제목·주소·소개 저장.
2. 사이트 수정·주소 변경·공개/비공개·삭제. 예약된 운영 경로는 사용할 수 없습니다.
3. 다른 기기가 먼저 수정했다면 목록을 새로고침한 뒤 다시 수정합니다.
4. 버드에서 파일을 등록하고 **송신 탭을 열어 둡니다**. 같은 계정의 다른 기기에서 수신·다운로드합니다.
5. 공개 사이트 목록 API는 `/domain/api/public/sites`입니다. 선택적 랜딩 연동용 스크립트는 `public/landing.js`입니다. 기존 에이두 전체 랜딩 사이트는 이 저장소에 포함하지 않습니다.

## PC / Termux CLI

Termux:

```sh
pkg install python curl
pip install websocket-client==1.9.0
curl -fsS https://aiedue.ddns.net/domain/bird.py -o bird.py
python bird.py login
```

직접 설치한 서버에서는 해당 주소를 사용합니다. 공통 옵션은 하위 명령 앞에 지정합니다.

```sh
python bird.py --base http://127.0.0.1:3099 login
python bird.py --base http://127.0.0.1:3099 send ./file.zip --label my-device

# 같은 계정의 다른 기기
python bird.py --base http://127.0.0.1:3099 list
python bird.py --base http://127.0.0.1:3099 receive OFFER_ID --out ./received.zip
python bird.py --base http://127.0.0.1:3099 logout
```

- 기본 서버 주소는 에이두 운영 서비스입니다. 자체 서버는 `--base`를 사용하세요.
- 세션은 기본 `~/.config/narae-bird/auth.json`에 권한 600으로 저장됩니다. OS별 파일 권한 모델 차이에 유의하세요.
- 로그아웃하면 서버 세션을 폐기하고 로컬 인증 파일도 지웁니다.
- 송신과 수신은 동시에 연결되어 있어야 합니다. 전송 등록은 30분 후 만료되며 계정당 대기 등록은 10개입니다.
- CLI는 `.part` 파일에 받은 후 크기·SHA-256 검증을 거쳐 확정하며 기존 파일을 덮어쓰지 않습니다. 브라우저 수신은 브라우저의 일반 다운로드 기능을 사용합니다.

## Termux / PC 웹·API 서버 연결

먼저 기기에서 실제 로컬 서버를 실행합니다. 아래 정적 서버는 **현재 폴더를 공개**하므로 공개할 파일만 있는 폴더에서 실행하세요.

```sh
python -m http.server 8080 --bind 127.0.0.1
```

다른 터미널의 로그인된 CLI에서:

```sh
python bird.py connect --port 8080 --label my-device
# 자체 게이트웨이: python bird.py --base https://example.com connect --port 8080
```

도메인 관리에서 종류를 Termux 연결로 선택한 뒤 연결된 기기를 지정합니다. 공유기 포트 개방 없이 기기가 먼저 WSS 연결을 맺습니다.

지원 범위·제한:

- 외부 `/my-site/api` → 기기의 `/api`. 앱의 절대경로 자원은 base path를 `/my-site/`로 맞춰야 합니다.
- 요청당 최대 16MiB, 기기당 최대 8개 동시 HTTP 요청. 큰 파일은 버드를 사용하세요.
- 관리자 Cookie·Authorization·Set-Cookie를 기기 서버와 공유하지 않으며 응답에 CSP sandbox를 적용합니다.
- 동일출처 브라우저 저장소·쿠키 인증이 필요한 앱과 앱 자체 WebSocket 업그레이드는 현재 지원하지 않습니다.
- 연결 해제 시 503을 반환하고 커넥터는 자동 재연결합니다. 로컬 서버 자체를 생성하거나 자동시작 설정을 바꾸지는 않습니다.
- Android 절전·백그라운드 제한은 별도입니다. 필요하면 `termux-wake-lock`을 사용하세요.

## HTTPS 운영과 환경 변수

Caddy 전용 호스트의 최소 예시:

```caddyfile
example.com {
    reverse_proxy 127.0.0.1:3099 {
        flush_interval -1
        transport http {
            read_timeout 0
            write_timeout 0
        }
    }
}
```

이 경우 `APP_ORIGIN=https://example.com`으로 서버를 실행합니다. 이 예시는 전용 호스트용이며, 다른 서비스와 공유하는 Caddy 설정을 그대로 덮어쓰는 용도가 아닙니다.

주요 환경 변수:

- `HOST`, `PORT`: 기본 `127.0.0.1`, `3099`.
- `APP_ORIGIN`: 외부 URL의 origin. 기본 `https://aiedue.ddns.net`.
- `DATA_DIR`: DB 등 영속 데이터 경로. 기본 `./data`(서버 파일 기준).
- `CATALOG_FILE`: 기존 운영 경로·선택적 랜딩 항목의 JSON 파일. 자체 설치에서는 `[]`가 담긴 JSON을 지정해 에이두 기본 예약 항목을 대체할 수 있습니다.
- `DYNAMIC_FALLBACK=1`: 이미 프록시 fallback이 설정된 환경에서 사이트 변경마다 라우트 재생성을 생략합니다.
- `ROUTES_FILE`, `ROUTE_SYNC`: 기존 에이두 Caddy 연동용 선택 옵션. 기본 리슨 포트를 가정하므로 일반 자체 설치에서는 설정하지 않아도 됩니다.
- `LEGACY_LOGIN_URL`: 신뢰할 수 있는 기존 관리자 로그인 서비스의 선택적 연동 URL. 관리자 역할만 수용합니다. 자체 설치에서는 생략합니다.

`ops/caddy-route-keeper.py`와 `ops/route-sync.py`는 기존 에이두 Linux 운영 환경용 보조 스크립트입니다. **로컬 빠른 시작에는 필요하지 않으며**, 기존 경로·Caddy 환경을 확인하지 않고 실행하지 마세요. keeper의 경로는 환경 변수로 바꿀 수 있고 route-sync는 기존 에이두 설치 경로를 가정합니다.

## 검증

```sh
npm ci --ignore-scripts
python -m pip install -r requirements.txt
npm test
python -m unittest discover -s test -p 'test_*.py'
```

포함: 계정·세션·CSRF·로그아웃, 사이트/기기/파일 소유권 격리, 예약 경로·수정 충돌·rollback, 파일 바이트·해시 일치와 서버 디스크 미저장, 빈 파일·취소, 실제 Python CLI 송수신·덮어쓰기 방지·부분 파일 정리, Python 커넥터 HTTP/API 중계·인증 헤더 격리, Caddy 무변경 재조정, 독립 설치 관리자 생성·기존 계정 보존.

기존 에이두 운영 환경에서는 공개 브라우저 전송·PC↔Pi 양방향 CLI·공개 HTTPS→Pi HTTP/API를 별도 검증했습니다. **Android Termux 실기기 설치·실행은 미검증**이며 PC/Pi 성공이 이를 대신하지 않습니다.

## 소스 출처

[y5496694/aiedue](https://github.com/y5496694/aiedue)의 `tools/domain-bird`를 다음 main 커밋에서 추출했습니다.

`86253ba7a09c606a2931bb9b9dbc5dffdcb5fa24`

서버·브라우저·CLI·기존 회귀 테스트는 해당 소스를 유지하며, 독립 저장소용 실행 안내·관리자 생성 보조 도구·ignore 규칙·CI를 추가했습니다. 운영 DB·세션·비밀정보나 전체 에이두 저장소 이력은 가져오지 않았습니다.
