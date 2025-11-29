# 🚀 빠른 시작 가이드

## 로컬에서 npm 배포 테스트하기

### 방법 1: 자동화 스크립트 (권장)

프로젝트 루트에서:

```bash
npm run test:local
```

이 명령어는 자동으로:
1. ✅ 프로젝트 빌드
2. ✅ npm 패키지 생성 (.tgz)
3. ✅ 테스트 앱 의존성 설치
4. ✅ 로컬 패키지 설치

완료 후 개발 서버 시작:

```bash
cd test-publish/example-app
npm run dev
```

### 방법 2: 수동 실행

```bash
# 1. 빌드
npm run build

# 2. 패키지 생성
npm pack

# 3. 테스트 앱으로 이동
cd test-publish/example-app

# 4. 의존성 설치
npm install

# 5. 로컬 패키지 설치
npm install ../../tab-chief-1.0.0.tgz

# 6. 개발 서버 시작
npm run dev
```

## 📱 테스트 방법

1. **브라우저에서 http://localhost:3000 자동 실행**

2. **여러 탭 열기**
   - Ctrl+T (Windows/Linux) 또는 Cmd+T (Mac)으로 새 탭 열기
   - 같은 URL로 최소 2-3개 탭 열기

3. **Leader Election 확인**
   - 하나의 탭: 👑 Chief (초록색)
   - 나머지 탭: 👥 Follower (파란색)

4. **기능 테스트**
   - "테스트 메시지 전송" → 모든 탭에서 메시지 수신 확인
   - Chief 탭 닫기 → 다른 탭이 Chief로 승격 확인
   - "Stop" → 해당 탭이 election에서 제외됨
   - "Restart" → 다시 election에 참여

5. **로그 확인**
   - 페이지 하단의 메시지 로그에서 실시간 이벤트 확인
   - 각 탭의 ID, 상태 확인

## 🐛 문제 해결

### 패키지를 찾을 수 없음
```bash
# dist 폴더 확인
ls dist/

# 없다면 빌드 실행
npm run build
```

### 이전 버전이 설치됨
```bash
cd test-publish/example-app
rm -rf node_modules package-lock.json
npm run test:local
```

### 포트 3000이 이미 사용 중
```bash
# vite.config.js에서 포트 변경
# server.port를 3001, 3002 등으로 변경
```

## ✅ 배포 전 최종 체크

```bash
# 타입 체크
npm run typecheck

# 테스트 실행
npm run test:run

# 빌드
npm run build

# 배포 시뮬레이션
npm run publish:dry
```

모두 통과하면 npm 배포 준비 완료! 🎉
