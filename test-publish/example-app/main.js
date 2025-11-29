// Tab Chief를 로컬 패키지에서 import
// 실제 npm에서 설치 후: import { TabChief } from 'tab-chief';
import { TabChief } from 'tab-chief';

let chief = null;
let messageCount = 0;

function log(message) {
  const logEl = document.getElementById('log');
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const timestamp = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="timestamp">[${timestamp}]</span>${message}`;

  logEl.insertBefore(entry, logEl.firstChild);
  messageCount++;
  document.getElementById('msgCount').textContent = messageCount;
}

function updateStatus() {
  const statusEl = document.getElementById('status');
  const tabIdEl = document.getElementById('tabId');
  const stateEl = document.getElementById('state');

  if (!chief) {
    statusEl.textContent = 'Stopped';
    statusEl.className = 'status';
    return;
  }

  const isChief = chief.isChief;
  const state = chief.currentState;
  const tabId = chief.id;

  statusEl.textContent = isChief ? '👑 Chief (리더)' : '👥 Follower (팔로워)';
  statusEl.className = `status ${isChief ? 'chief' : 'follower'}`;

  tabIdEl.textContent = tabId;
  stateEl.textContent = state;
}

function initChief() {
  chief = new TabChief({
    channelName: 'test-app',
    heartbeatInterval: 1000,
    electionTimeout: 3000
  });

  // Chief 전용 작업 등록
  chief.runExclusive(() => {
    log('✅ Chief로 승격됨 - 독점 작업 시작');
    updateStatus();

    // Chief만 실행하는 주기적 작업
    const interval = setInterval(() => {
      const timestamp = new Date().toISOString();
      chief.postMessage({
        type: 'HEARTBEAT',
        timestamp,
        from: chief.id
      });
    }, 5000);

    // Cleanup 함수 (Chief 자격 상실 시 실행)
    return () => {
      clearInterval(interval);
      log('⚠️ Chief 자격 상실 - 독점 작업 정리');
      updateStatus();
    };
  });

  // 메시지 수신 (모든 탭에서 동작)
  chief.onMessage((data) => {
    log(`📨 메시지 수신: ${JSON.stringify(data)}`);
  });

  // 시작
  chief.start();
  log('🚀 Tab Chief 시작');
  updateStatus();

  // 상태 변경 모니터링
  setInterval(updateStatus, 500);
}

// 전역 함수로 노출
window.sendTestMessage = () => {
  if (!chief) {
    alert('Chief가 초기화되지 않았습니다');
    return;
  }

  const message = {
    type: 'TEST',
    data: `테스트 메시지 ${Date.now()}`,
    from: chief.id
  };

  chief.postMessage(message);
  log(`📤 메시지 전송: ${JSON.stringify(message)}`);
};

window.stopChief = () => {
  if (chief) {
    chief.stop();
    log('⏹️ Chief 중지됨');
    chief = null;
    updateStatus();
  }
};

window.restartChief = () => {
  if (chief) {
    chief.stop();
    chief = null;
  }
  log('🔄 Chief 재시작');
  initChief();
};

window.clearLogs = () => {
  document.getElementById('log').innerHTML = '';
  messageCount = 0;
  document.getElementById('msgCount').textContent = '0';
};

// 페이지 로드 시 자동 시작
initChief();

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
  if (chief) {
    chief.stop();
  }
});
