# 폰·태블릿 서버 운영 · PC 배포 · 나래온 리모트

**나래 버드는 지정된 휴대폰·태블릿에 나래온 APK를 설치한 뒤, 해당 기기를 서버 구동 기기로 활용하는 작업에 특화된 저장소입니다.** PC에서 서버·사이트를 준비하고 나래 버드로 파일을 옮긴 후, 기기의 Termux에서 실행하고 도메인으로 공개할 수 있습니다. 나래온 리모트로는 나래온이 설치된 폰·태블릿의 화면을 확인하고 원격 제어하여 조종할 수 있습니다.

이 문서는 설치·운영 안내입니다. 앱을 설치하는 것만으로 서버·도메인·원격 연결이 자동 생성되지는 않습니다. **나래온은 기기 연결·조작, Termux는 실제 서버 실행, 버드는 파일 전송, 도메인은 경로 공개**를 담당합니다.

## 1. 준비물과 연결 구조

- 서버로 사용할 지정 Android 폰·태블릿, 충분한 내부 저장공간과 지속 가능한 전원·네트워크.
- [최신 나래온 APK 및 배포 조건](downloads.md). Android 버전·CPU ABI·시험 채널·설치 주의사항은 현재 스토어 상세를 확인하세요.
- [F-Droid](https://f-droid.org/ko/)에서 설치한 [Termux](https://f-droid.org/ko/packages/com.termux/).
- 파일을 보낼 PC와 버드·도메인에서 사용할 **같은 관리자 계정**. 기존 운영 서비스 계정이 없다면 운영자에게 계정을 요청하거나 [자체 서버를 설치](../README.md#로컬에서-시작)하세요. 나래온 로그인과 버드 관리자 로그인은 같은 기능이 아닙니다.
- PC 리모트: Windows 10/11, Python 3.10 이상, 해당 기기에서 승인한 나래온 MCP 연결.

```text
PC에서 서버/사이트 개발·빌드
  ├─ 나래 버드 → 파일 수신 → 폰·태블릿의 Termux → 실제 서버 실행
  │                                   └─ WSS 커넥터 → 도메인 → 공개 HTTPS /내주소/
  └─ 나래온 리모트 ↔ 지정 기기의 나래온 ↔ 화면 확인·Termux 등 허용 앱 조작
```

웹/API 서버를 계속 돌리는 쪽은 **폰·태블릿**입니다. 파일 전송이 끝난 PC는 끌 수 있지만, 기존 HTTPS 게이트웨이와 폰의 서버·커넥터는 켜져 있어야 합니다. PC에 따로 설치한 게이트웨이를 쓴다면 그 PC도 계속 켜져 있어야 합니다. 리모트 PC는 원격 확인·조작할 때 필요합니다.

## 2. 나래온 APK 설치·업데이트

1. 지정 기기에서 [나래온 최신 다운로드 문서](downloads.md)를 엽니다. 바로 현재 등록을 확인하려면 [나래온 다운로드 페이지](https://aiedue.ddns.net/naraeon/#downloads)나 [에이두 스토어](https://aiedue.ddns.net/appstore/)를 사용하세요.
2. 현재 기기의 Android·ABI와 맞는지 확인하고 APK를 받습니다. 설치에 사용할 브라우저·파일 앱의 **이 출처의 앱 설치 허용**을 Android 안내에 따라 설정하고 설치합니다.
3. 기존 나래온이 있으면 **삭제·데이터 초기화가 아니라 업데이트로 설치**합니다. 서명·패키지 불일치 등으로 거부되면 상세 안내와 기록 백업부터 확인하세요.
4. 앱을 열고 실제 사용할 나래온 연결을 설정합니다. 원격 사용에는 아래 6절의 기기별 승인·PC 등록도 필요합니다.

저장소의 다운로드 문서는 스토어 카탈로그를 매시간 확인해 자동 갱신합니다. 기기에 이미 설치된 APK를 이 저장소가 무확인 자동 설치하는 것은 아닙니다.

## 3. F-Droid 설치 → F-Droid판 Termux 설치

**폰·태블릿으로 서버를 운영할 때는 F-Droid에서 배포하는 Termux의 최신 안정판으로 서버를 구동하는 것을 권장합니다.** 이 안내의 기준은 F-Droid판입니다. 특정 베타 버전 번호를 강제로 지정하지 않습니다.

1. 기기 브라우저에서 **[F-Droid 공식 사이트](https://f-droid.org/ko/)**를 열고 F-Droid APK를 받습니다.
2. Android가 요청하면 해당 브라우저·파일 앱에 이 출처의 앱 설치를 허용하고 F-Droid를 설치·실행합니다.
3. F-Droid의 저장소 목록 갱신이 끝날 때까지 기다립니다. 검색에서 **Termux**를 찾고 패키지가 **`com.termux`**인지 확인합니다.
4. F-Droid에서 권장하는 **최신 안정판**을 설치합니다. 웹 패키지 목록의 맨 위가 베타일 수 있으므로 무조건 첫 APK를 고르지 마세요. F-Droid가 설치 권한을 요청하면 직접 승인합니다.
5. Termux를 한 번 열어 초기 환경 준비를 끝냅니다.
6. Termux:Boot·Termux:API 같은 추가 앱이 필요하면 **모두 같은 F-Droid 출처**에서 설치합니다. 이 문서의 기본 구동에는 추가 앱이 필수는 아닙니다.

이미 GitHub판·Google Play판 Termux가 있으면 F-Droid판과 서명·구성이 다를 수 있습니다. **데이터를 백업하지 않고 기존 Termux나 플러그인을 먼저 삭제하지 마세요.** 출처를 섞어 덮어쓰는 방식은 권장하지 않습니다. Google Play의 실험 브랜치와 F-Droid판을 같은 빌드로 취급하지 않습니다.

F-Droid 앱 없이 [공식 Termux 패키지 페이지](https://f-droid.org/ko/packages/com.termux/)에서 APK를 직접 받는 것도 가능하지만, 지속적인 업데이트 관리를 위해 위 F-Droid 앱 경로를 권장합니다.

Termux에서:

```sh
pkg update && pkg upgrade
pkg install python curl git
python -m pip install websocket-client==1.9.0
mkdir -p ~/narae-bird-runtime ~/narae-server/releases
cd ~/narae-bird-runtime
curl -fL https://aiedue.ddns.net/domain/bird.py -o bird.py
python bird.py --help
python bird.py login
```

로그인은 로컬 프롬프트에서 입력합니다. 실제 비밀번호·세션 파일·MCP 주소/토큰은 명령 예제, 채팅, 공개 저장소에 넣지 마세요. 자체 게이트웨이는 모든 CLI 호출에서 `python bird.py --base https://example.com ...` 형태로 **하위 명령 앞에** 주소를 지정합니다.

## 4. PC에서 준비 → 버드로 폰·태블릿에 배포

아래는 **공개할 정적 빌드 결과만 담긴 `dist` 폴더**를 보내는 예입니다. React/Vue 등은 먼저 정식 빌드를 하세요. `.env`, 비밀키, DB, 세션 파일, 소스 전체를 무심코 공개 폴더에 넣지 않습니다.

### PC (PowerShell)

```powershell
# 공개할 결과물 dist/가 있는 작업 폴더에서
Compress-Archive -Path .\dist\* -DestinationPath .\site-v1.zip
curl.exe -fL https://aiedue.ddns.net/domain/bird.py -o bird.py
python .\bird.py login
python .\bird.py send .\site-v1.zip --label build-pc
```

`송신 등록: ...`에 표시된 ID를 확인하고 **송신 명령을 종료하지 않습니다.** 실제 수신이 시작되기 전까지 이 PC가 파일을 보관합니다. CLI 대신 [버드 웹](https://aiedue.ddns.net/bird)에서 같은 계정으로 로그인해 전송할 수도 있습니다.

### 폰·태블릿 (Termux)

```sh
cd ~/narae-bird-runtime
python bird.py list
# 아래 OFFER_ID는 목록에 표시된 실제 전송 ID로 바꾸세요.
python bird.py receive OFFER_ID --out ~/narae-server/releases/site-v1.zip
mkdir -p ~/narae-server/releases/site-v1
python -m zipfile -e ~/narae-server/releases/site-v1.zip ~/narae-server/releases/site-v1
python -m http.server 8080 --bind 127.0.0.1 --directory ~/narae-server/releases/site-v1
```

- 폰·PC는 같은 버드 관리자 계정이어야 하며 송수신이 동시에 연결돼 있어야 합니다. 서버 디스크에 파일을 보관해 나중에 받는 클라우드 드라이브 방식이 아닙니다.
- CLI는 파일 크기·SHA-256 확인 후 수신 파일을 확정하며 기존 파일은 덮어쓰지 않습니다. 다음 배포에는 `site-v2.zip`, `site-v2/`처럼 새 경로를 쓰세요.
- 위 `http.server`는 정적 파일의 최소 확인 예시입니다. 실제 앱은 적합한 운영 서버로 교체하세요. 폴더 전체가 공개될 수 있으므로 공개 결과물만 둡니다.
- Python HTTP 서버를 켠 세션은 유지합니다. Termux에서 **새 세션**을 열어 아래 확인·커넥터를 실행하세요.

```sh
curl -f http://127.0.0.1:8080/
cd ~/narae-bird-runtime
python bird.py connect --port 8080 --label server-phone
```

Node.js API를 기기에서 구동할 수도 있습니다. 필요한 경우 `pkg install nodejs` 후 실제 앱의 의존성·시작 명령·Android 호환성을 별도로 확인하세요. **이 저장소의 게이트웨이 자체를 기기에 설치**하려면 Node.js 24 이상, Python 3.11 이상이 필요하지만, 위 정적 서버·커넥터 운영에는 게이트웨이 전체를 설치할 필요가 없습니다. 런타임 버전은 실제 `node --version`, `python --version`으로 확인합니다.

## 5. 도메인으로 공개하기

1. PC에서 [도메인 관리](https://aiedue.ddns.net/domain)에 같은 관리자 계정으로 로그인합니다.
2. 새 주소를 만들고 종류를 **Termux 연결**로 선택합니다.
3. 연결된 `server-phone` 기기를 지정하고 제목·경로·소개를 저장·공개합니다.
4. 발급된 **`https://aiedue.ddns.net/내주소/` 형태의 실제 주소**를 다른 기기에서 열어 콘텐츠를 확인합니다. 자체 게이트웨이를 썼다면 그 주소를 사용합니다.
5. 파일을 바꾼 뒤에도 공개 URL의 실제 내용이 바뀌는지 확인합니다. 커넥터 표시만으로 배포가 성공했다고 판단하지 않습니다.

`/내주소/`는 **경로 기반 주소**이지 `내주소.example.com` DNS 하위 도메인이 아닙니다. 기기에서 HTTPS 게이트웨이로 먼저 WSS 연결을 열므로 이 방식 때문에 폰의 공유기 포트를 개방할 필요는 없습니다.

현재 커넥터는 HTTP/API 중계이며, 앱 자체 WebSocket 업그레이드·동일출처 쿠키 인증 앱을 일반적으로 지원하는 터널은 아닙니다. 응답에는 CSP sandbox가 적용되고 관리자 인증 헤더·쿠키는 기기 앱과 공유하지 않습니다. 요청당 최대 16MiB·기기당 최대 동시 8개이며 큰 파일은 버드를 사용하세요. 앱 자원 경로는 발급된 base path에 맞춰야 합니다. DB·관리자·디버그 포트를 그대로 공개하지 않습니다.

## 6. 나래온 리모트로 해당 기기 원격 제어

**나래온 리모트는 나래온이 설치된 태블릿·휴대폰을 PC에서 원격 제어하여 조종할 수 있습니다.** 화면 확인, 터치, 한글 입력, 홈·뒤로·스크롤 등을 사용해 서버 기기의 허용 앱을 다룹니다. 나래 버드의 파일 전송과는 별도 연결입니다.

### PC에 리모트 준비

[공식 최신 릴리스](https://github.com/y5496694/remote-naraeon-cli/releases/latest)의 CLI ZIP을 받거나, 이 저장소에 포함한 공식 소스 하위 모듈을 사용합니다.

```powershell
git clone --recurse-submodules https://github.com/y5496694/narae-bird.git
cd .\narae-bird\remote\naraeon

# 이미 나래 버드를 받았다면 저장소 루트에서 먼저 실행:
# git submodule update --init --recursive
```

### 기기에서 먼저 설정

1. 기기의 나래온에서 해당 MCP 연결을 승인하고 기기별 실제 HTTPS 주소·Bearer 토큰을 준비합니다.
2. 기기에서 접근성 서비스, 허용 앱 목록(서버 작업에는 **Termux** 포함), 필요한 자동 조작 및 화면 이미지 전달을 직접 허용합니다.
3. 기기에서 **원격**을 선택합니다. 연결 등록만으로 권한·원격 모드가 자동 활성화되지 않습니다.

### PC에서 기기 이름으로 등록·확인

```powershell
# 실제 주소·토큰은 이 명령의 로컬 숨김 입력으로 등록
.\naraeon.cmd --device server-phone register
.\naraeon.cmd --device server-phone status
.\naraeon.cmd --device server-phone phone-status
.\naraeon.cmd monitor --devices server-phone
```

관제창에서 화면 보기를 시작하고, 조작하려는 기기의 **제어권 확인·인계** 후 터치·입력을 사용합니다. 입력은 곧바로 명령 실행·메시지 보내기를 의미하지 않으므로 실행 후 실제 화면과 서버 응답을 확인하세요. CLI에서 지원 도구를 확인하려면 `.\naraeon.cmd --device server-phone tools`를 사용합니다.

여러 기기를 쓸 때는 `server-phone`, `server-tablet` 등 각기 다른 이름·기기별 연결정보로 등록한 뒤:

```powershell
.\naraeon.cmd --device server-tablet register
.\naraeon.cmd monitor --devices server-phone server-tablet
```

- 검토 기준은 공식 리모트 **v0.4.0**입니다. 소스는 검토한 커밋에 고정되며, 최신 릴리스 안내와 하위 모듈의 실제 기능이 다를 수 있습니다.
- 최대 12개 기기의 **주기적 실제 화면 캡처**입니다. 고FPS 영상 스트리밍·게임용 원격 데스크톱으로 설명하지 않습니다.
- 각 기기의 기존 HTTPS MCP 연결이 온라인이면 서로 다른 네트워크에서도 연결할 수 있습니다. 기기·네트워크·백그라운드 정책의 영향은 별도입니다.
- 주소·토큰은 Windows 사용자 DPAPI로 암호화 저장하며 이 저장소에 커밋하지 않습니다. 관제창은 PC의 `127.0.0.1`에만 엽니다.
- 보호 화면·권한·잠금 제한을 우회하지 않습니다. 변경 요청이 시간 초과되면 현재 상태부터 확인하며 같은 조작을 무조건 재전송하지 않습니다.
- 관제 중지·업무 종료는 폰을 강제로 나래로 돌리지 않습니다. 기기에서 직접 채팅·전화·나래 버튼을 선택해 돌아갑니다.
- 세부 기능·조건은 포함된 `remote/naraeon/README.md` 또는 [공식 README](https://github.com/y5496694/remote-naraeon-cli#readme)와 [여러 태블릿 안내](https://github.com/y5496694/remote-naraeon-cli/blob/main/여러%20태블릿%20사용안내.md)를 확인하세요.

## 7. 장시간 운영·검증 체크

- Termux와 나래온의 Android 배터리·백그라운드 정책을 기기에서 확인합니다. `termux-wake-lock`은 CPU 절전 방지에 도움을 줄 뿐, OS 강제 종료·통신 끊김을 막는 보장은 아닙니다. 종료 후 불필요하면 `termux-wake-unlock`으로 해제합니다.
- 발열·충전·배터리 상태를 확인합니다. 장시간 서버는 기기 수명과 전원 안정성을 고려하세요.
- 실제 DB·서버 데이터는 **Termux 내부 저장공간**에 둡니다. `/sdcard` 공유 저장소를 라이브 DB 경로로 쓰지 말고, 기기 밖 백업과 복원 시험을 준비하세요. 앱 삭제·데이터 초기화로 서버 파일도 사라질 수 있습니다.
- 부팅 자동시작은 기본 예시에 포함하지 않습니다. 필요하면 같은 F-Droid 출처의 Termux:Boot 등으로 별도 구성하고 재부팅·첫 잠금해제 후 실제 복구를 검증하세요.

실기기 인수 체크:

- [ ] APK 설치 및 나래온 연결·승인 완료
- [ ] Termux 설치 및 런타임 버전 확인
- [ ] 실제 파일 송신 → 수신 → 해시 확인
- [ ] 기기의 로컬 서버 응답과 외부 공개 주소의 실제 콘텐츠 일치
- [ ] 쓰기·조회 → 서버 재시작 → 데이터 유지 확인(데이터 서버인 경우)
- [ ] 화면 꺼짐·네트워크 끊김/복귀·재부팅 후 복구 확인
- [ ] 나래온 리모트에서 지정한 기기만 화면 확인 → 조작 → 재확인
- [ ] 독립 백업·복원 시험

이 저장소의 PC/Pi 및 자동검사 통과를 Android 폰·태블릿 실기기 설치·운영 성공으로 대신하지 않습니다. 실기기 검증은 실제 대상 기기에서 별도로 수행합니다.

[다운로드](downloads.md) · [README](../README.md) · [도메인](https://aiedue.ddns.net/domain) · [버드](https://aiedue.ddns.net/bird)
