# Tab Chief 배포 테스트 환경

이 폴더는 tab-chief 패키지를 npm에 배포하기 전에 로컬에서 테스트하는 환경입니다.

## 📦 테스트 방법

### 1. 로컬 패키지 빌드 및 패킹

프로젝트 루트에서:

```bash
# 프로젝트 빌드
npm run build

# npm 패키지 생성 (.tgz 파일)
npm pack
```

이 명령은 `tab-chief-1.0.0.tgz` 파일을 생성합니다.

### 2. 테스트 앱에서 로컬 패키지 설치

```bash
cd test-publish/example-app

# 의존성 설치
npm install

# 로컬 패키지 설치 (루트 디렉토리의 .tgz 파일)
npm install ../../tab-chief-1.0.0.tgz
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저가 자동으로 열리고 http://localhost:3000 에서 테스트 앱이 실행됩니다.

### 4. Leader Election 테스트

1. 여러 개의 탭을 열어보세요
2. 각 탭의 상태를 확인하세요:
   - 하나의 탭만 **Chief (리더)** 상태
   - 나머지 탭은 **Follower** 상태
3. Chief 탭을 닫으면 다른 탭이 자동으로 Chief로 승격됩니다
4. 메시지 전송 버튼으로 모든 탭 간 메시지 통신 테스트

## 🧪 한 번에 실행하기

프로젝트 루트에서 다음 스크립트를 실행하면 모든 과정이 자동화됩니다:

```bash
# 빌드, 패킹, 설치, 실행을 한 번에
npm run test:local
```

## 📝 테스트 시나리오

### 시나리오 1: 기본 Leader Election
1. 첫 번째 탭 열기 → Chief 상태 확인
2. 두 번째 탭 열기 → Follower 상태 확인
3. Chief 탭 닫기 → Follower가 Chief로 승격 확인

### 시나리오 2: 메시지 브로드캐스팅
1. 여러 탭 열기
2. Chief 탭에서 "테스트 메시지 전송" 버튼 클릭
3. 모든 탭에서 동일한 메시지 수신 확인

### 시나리오 3: Stop/Restart
1. Chief 탭에서 "Stop" 버튼 클릭
2. 다른 탭이 Chief로 승격되는지 확인
3. "Restart" 버튼 클릭하여 재참여 확인

### 시나리오 4: 독점 작업 실행
1. 로그에서 "Chief로 승격됨 - 독점 작업 시작" 메시지 확인
2. Chief 변경 시 "독점 작업 정리" 메시지 확인
3. 5초마다 HEARTBEAT 메시지가 Chief에서만 전송되는지 확인

## 🔍 디버깅

### 브라우저 개발자 도구
- Console: 에러 및 디버그 로그 확인
- Application > Storage > BroadcastChannel: 채널 활동 모니터링

### 로그 확인
- 테스트 앱의 "메시지 로그" 섹션에서 실시간 로그 확인
- 각 탭의 ID, 상태, 메시지 카운트 확인

## 🚀 npm 배포 전 체크리스트

- [ ] 로컬 테스트 성공
- [ ] 여러 탭에서 Leader Election 정상 동작
- [ ] 메시지 브로드캐스팅 정상 동작
- [ ] 독점 작업 실행/정리 정상 동작
- [ ] TypeScript 타입 정의 확인
- [ ] README 문서 최신화
- [ ] `npm run test:run` 통과
- [ ] `npm run typecheck` 통과
- [ ] `npm run publish:dry` 확인

## 📦 실제 npm 배포 후 테스트

배포 후에는 로컬 패키지 대신 실제 npm 패키지를 설치하여 테스트:

```bash
# 로컬 패키지 제거
npm uninstall tab-chief

# npm에서 설치
npm install tab-chief

# vite.config.js에서 alias 제거하고 테스트
npm run dev
```
