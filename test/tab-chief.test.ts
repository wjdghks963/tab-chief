import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TabChief, TabState } from '../src/index';

// Mock BroadcastChannel
class MockBroadcastChannel {
  static channels: Map<string, Set<MockBroadcastChannel>> = new Map();

  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;

    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(message: unknown): void {
    const channels = MockBroadcastChannel.channels.get(this.name);
    if (channels) {
      // Simulate async message delivery
      setTimeout(() => {
        channels.forEach((channel) => {
          if (channel !== this && channel.onmessage) {
            channel.onmessage(new MessageEvent('message', { data: message }));
          }
        });
      }, 0);
    }
  }

  close(): void {
    const channels = MockBroadcastChannel.channels.get(this.name);
    if (channels) {
      channels.delete(this);
    }
  }

  static reset(): void {
    MockBroadcastChannel.channels.clear();
  }
}

// Setup global mocks
vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

describe('TabChief', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockBroadcastChannel.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const chief = new TabChief();
      expect(chief.id).toBeDefined();
      expect(chief.currentState).toBe(TabState.IDLE);
      expect(chief.isChief).toBe(false);
    });

    it('should create instance with custom options', () => {
      const chief = new TabChief({
        channelName: 'custom-channel',
        heartbeatInterval: 2000,
        electionTimeout: 5000,
      });
      expect(chief.id).toBeDefined();
      expect(chief.currentState).toBe(TabState.IDLE);
    });
  });

  describe('start()', () => {
    it('should transition from IDLE to ELECTING', () => {
      const chief = new TabChief();
      chief.start();
      expect(chief.currentState).toBe(TabState.ELECTING);
      chief.stop();
    });

    it('should become CHIEF after election timeout with no competitors', async () => {
      const chief = new TabChief({ electionTimeout: 1000 });
      chief.start();

      expect(chief.currentState).toBe(TabState.ELECTING);

      // Fast-forward past election timeout
      vi.advanceTimersByTime(1100);

      expect(chief.currentState).toBe(TabState.CHIEF);
      expect(chief.isChief).toBe(true);

      chief.stop();
    });
  });

  describe('stop()', () => {
    it('should stop and cleanup', () => {
      const chief = new TabChief();
      chief.start();
      vi.advanceTimersByTime(3100);

      chief.stop();
      expect(chief.currentState).toBe(TabState.STOPPED);
    });

    it('should not error when called multiple times', () => {
      const chief = new TabChief();
      chief.start();
      chief.stop();
      chief.stop();
      expect(chief.currentState).toBe(TabState.STOPPED);
    });
  });

  describe('runExclusive()', () => {
    it('should run task when becoming Chief', () => {
      const chief = new TabChief({ electionTimeout: 1000 });
      const task = vi.fn(() => () => {});

      chief.runExclusive(task);
      chief.start();

      expect(task).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1100);

      expect(task).toHaveBeenCalledTimes(1);
      chief.stop();
    });

    it('should run task immediately if already Chief', () => {
      const chief = new TabChief({ electionTimeout: 1000 });
      chief.start();
      vi.advanceTimersByTime(1100);

      const task = vi.fn(() => () => {});
      chief.runExclusive(task);

      expect(task).toHaveBeenCalledTimes(1);
      chief.stop();
    });

    it('should call cleanup function when stopped', () => {
      const cleanup = vi.fn();
      const task = vi.fn(() => cleanup);

      const chief = new TabChief({ electionTimeout: 1000 });
      chief.runExclusive(task);
      chief.start();

      vi.advanceTimersByTime(1100);
      expect(task).toHaveBeenCalled();

      chief.stop();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should handle task that returns void', () => {
      const chief = new TabChief({ electionTimeout: 1000 });
      const task = vi.fn();

      chief.runExclusive(task);
      chief.start();
      vi.advanceTimersByTime(1100);

      expect(task).toHaveBeenCalled();
      expect(() => chief.stop()).not.toThrow();
    });
  });

  describe('postMessage() and onMessage()', () => {
    it('should send and receive messages locally', () => {
      const chief = new TabChief({ electionTimeout: 1000 });
      const callback = vi.fn();

      chief.onMessage(callback);
      chief.start();
      vi.advanceTimersByTime(1100);

      chief.postMessage({ test: 'data' });

      expect(callback).toHaveBeenCalledWith({ test: 'data' });
      chief.stop();
    });

    it('should not send messages when stopped', () => {
      const chief = new TabChief();
      const callback = vi.fn();

      chief.onMessage(callback);
      chief.postMessage({ test: 'data' });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Leader Election', () => {
    it('should elect single Chief among multiple tabs', async () => {
      const chief1 = new TabChief({
        channelName: 'test-election',
        electionTimeout: 1000,
      });
      const chief2 = new TabChief({
        channelName: 'test-election',
        electionTimeout: 1000,
      });

      chief1.start();
      chief2.start();

      // Allow message propagation
      await vi.advanceTimersByTimeAsync(50);

      // Fast-forward past election timeout
      await vi.advanceTimersByTimeAsync(1100);

      // Only one should be Chief
      const chiefCount = [chief1, chief2].filter((c) => c.isChief).length;
      expect(chiefCount).toBe(1);

      chief1.stop();
      chief2.stop();
    });

    it('should transfer leadership on Chief shutdown', async () => {
      const chief1 = new TabChief({
        channelName: 'test-transfer',
        electionTimeout: 500,
        heartbeatInterval: 200,
      });

      // chief1 starts and becomes Chief
      chief1.start();
      await vi.advanceTimersByTimeAsync(600);
      expect(chief1.isChief).toBe(true);

      const chief2 = new TabChief({
        channelName: 'test-transfer',
        electionTimeout: 500,
        heartbeatInterval: 200,
      });

      // chief2 starts - will receive heartbeat and become Follower
      chief2.start();
      await vi.advanceTimersByTimeAsync(10); // Initial message propagation
      await vi.advanceTimersByTimeAsync(200); // Wait for heartbeat cycle

      // Shutdown chief1 - will trigger immediate election in chief2
      chief1.stop();
      await vi.advanceTimersByTimeAsync(10); // Shutdown message propagation

      // chief2 starts election after receiving shutdown
      // electionDebounce(100) + electionTimeout(500) + buffer
      await vi.advanceTimersByTimeAsync(700);

      expect(chief2.isChief).toBe(true);

      chief2.stop();
    });
  });

  describe('Cleanup on leadership loss', () => {
    it('should run cleanup when losing leadership', async () => {
      const cleanup = vi.fn();
      const task = vi.fn(() => cleanup);

      // Start first tab and become Chief
      const chief1 = new TabChief({
        channelName: 'test-cleanup',
        electionTimeout: 500,
        heartbeatInterval: 100,
      });

      chief1.runExclusive(task);
      chief1.start();
      await vi.advanceTimersByTimeAsync(600);

      expect(chief1.isChief).toBe(true);
      expect(task).toHaveBeenCalled();
      expect(cleanup).not.toHaveBeenCalled();

      // Stop chief1 - cleanup should be called
      chief1.stop();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Tab ID generation', () => {
    it('should generate unique IDs for each instance', () => {
      const chiefs = Array.from({ length: 10 }, () => new TabChief());
      const ids = chiefs.map((c) => c.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(10);
    });
  });
});
