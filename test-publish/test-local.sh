#!/bin/bash

# Tab Chief 로컬 패키지 테스트 자동화 스크립트

set -e  # 에러 발생 시 스크립트 중단

echo "🔨 1단계: 프로젝트 빌드 중..."
cd "$(dirname "$0")/.."
npm run build

echo ""
echo "📦 2단계: npm 패키지 생성 중..."
npm pack

echo ""
echo "🧹 3단계: 이전 테스트 환경 정리 중..."
cd test-publish/example-app
rm -rf node_modules package-lock.json

echo ""
echo "📥 4단계: 의존성 설치 중..."
npm install

echo ""
echo "📦 5단계: 로컬 패키지 설치 중..."
# 최신 .tgz 파일 찾기
TGZ_FILE=$(ls ../../tab-chief-*.tgz 2>/dev/null | tail -n 1)
if [ -z "$TGZ_FILE" ]; then
    echo "❌ 에러: .tgz 파일을 찾을 수 없습니다"
    exit 1
fi

echo "설치 중: $TGZ_FILE"
npm install "$TGZ_FILE"

echo ""
echo "✅ 설치 완료!"
echo ""
echo "🚀 개발 서버를 시작하려면:"
echo "   cd test-publish/example-app"
echo "   npm run dev"
echo ""
echo "또는 자동으로 시작하려면 다음 명령어를 실행하세요:"
echo "   cd test-publish/example-app && npm run dev"
