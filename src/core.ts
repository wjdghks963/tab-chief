import {
  TabChiefOptions,
  CleanupFunction,
  ExclusiveTask,
  MessageCallback,
  StateChangeCallback,
  LeadershipCallback,
  MessageType,
  ChannelMessage,
  TabState,
  BaseMessage,
  DataMessage,
} from './types';

/** Default configuration values */
const DEFAULT_CHANNEL_NAME = 'tab-chief-default';
const DEFAULT_HEARTBEAT_INTERVAL = 1000;
const DEFAULT_ELECTION_TIMEOUT = 3000;

/** Debounce time for rapid tab reloading */
const ELECTION_DEBOUNCE_TIME = 100;

/**
 * Generate a unique identifier for this tab
 */
function generateTabId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * TabChief - Leader Election for Browser Tabs
 *
 * Implements a simplified Bully Algorithm using BroadcastChannel
 * to elect a single "Chief" tab among multiple browser tabs.
 */
export class TabChief {
  private readonly tabId: string;
  private readonly channelName: string;
  private readonly heartbeatInterval: number;
  private readonly electionTimeout: number;
  private readonly creationTimestamp: number;

  private channel: BroadcastChannel | null = null;
  private state: TabState = TabState.IDLE;
  private currentChiefId: string | null = null;

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private electionTimer: ReturnType<typeof setTimeout> | null = null;
  private electionDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private exclusiveTasks: ExclusiveTask[] = [];
  private activeCleanups: CleanupFunction[] = [];
  private messageCallbacks: MessageCallback<unknown>[] = [];
  private stateChangeCallbacks: StateChangeCallback[] = [];
  private becomeChiefCallbacks: LeadershipCallback[] = [];
  private becomeFollowerCallbacks: LeadershipCallback[] = [];

  private boundBeforeUnload: (() => void) | null = null;

  constructor(options?: TabChiefOptions) {
    this.tabId = generateTabId();
    this.creationTimestamp = Date.now();
    this.channelName = options?.channelName ?? DEFAULT_CHANNEL_NAME;
    this.heartbeatInterval = options?.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL;
    this.electionTimeout = options?.electionTimeout ?? DEFAULT_ELECTION_TIMEOUT;
  }

  /**
   * Returns true if this tab is currently the Chief (leader)
   */
  public get isChief(): boolean {
    return this.state === TabState.CHIEF;
  }

  /**
   * Returns the current tab state
   */
  public get currentState(): TabState {
    return this.state;
  }

  /**
   * Returns the unique identifier of this tab
   */
  public get id(): string {
    return this.tabId;
  }

  /**
   * Starts the election process
   */
  public start(): void {
    if (this.state !== TabState.IDLE && this.state !== TabState.STOPPED) {
      return;
    }

    // Initialize BroadcastChannel
    this.channel = new BroadcastChannel(this.channelName);
    this.channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
      this.handleMessage(event.data);
    };

    // Set up graceful shutdown
    this.boundBeforeUnload = this.handleBeforeUnload.bind(this);
    window.addEventListener('beforeunload', this.boundBeforeUnload);

    // Start election
    this.startElection();
  }

  /**
   * Stops the election, closes channels, and runs cleanup
   */
  public stop(): void {
    if (this.state === TabState.STOPPED || this.state === TabState.IDLE) {
      return;
    }

    // Announce shutdown if we're the Chief
    if (this.state === TabState.CHIEF) {
      this.broadcast({
        type: MessageType.SHUTDOWN,
        senderId: this.tabId,
        timestamp: Date.now(),
      });
    }

    // Run cleanup functions for exclusive tasks
    this.runCleanups();

    // Clear all timers
    this.clearTimers();

    // Remove event listener
    if (this.boundBeforeUnload) {
      window.removeEventListener('beforeunload', this.boundBeforeUnload);
      this.boundBeforeUnload = null;
    }

    // Close channel
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    this.setState(TabState.STOPPED);
    this.currentChiefId = null;
  }

  /**
   * [CORE FEATURE: Effect Pattern]
   * Registers a task that runs ONLY when this tab becomes the Chief.
   * The task MUST return a cleanup function (or void) that executes
   * immediately when leadership is lost or the tab closes.
   *
   * @param task - Function to run when becoming Chief, should return cleanup function
   */
  public runExclusive(task: ExclusiveTask): void {
    this.exclusiveTasks.push(task);

    // If already Chief, run the task immediately
    if (this.state === TabState.CHIEF) {
      this.runTask(task);
    }
  }

  /**
   * Broadcasts a message to all tabs (including the sender)
   *
   * @param data - Data to broadcast
   */
  public postMessage<T>(data: T): void {
    if (!this.channel || this.state === TabState.STOPPED || this.state === TabState.IDLE) {
      return;
    }

    const message: DataMessage<T> = {
      type: MessageType.DATA,
      senderId: this.tabId,
      timestamp: Date.now(),
      payload: data,
    };

    this.channel.postMessage(message);

    // Also notify local callbacks
    this.notifyMessageCallbacks(data);
  }

  /**
   * Subscribes to messages from the channel
   *
   * @param callback - Function to call when a message is received
   */
  public onMessage<T>(callback: MessageCallback<T>): void {
    this.messageCallbacks.push(callback as MessageCallback<unknown>);
  }

  /**
   * Removes a message callback
   *
   * @param callback - The callback function to remove
   */
  public offMessage<T>(callback: MessageCallback<T>): void {
    const index = this.messageCallbacks.indexOf(callback as MessageCallback<unknown>);
    if (index !== -1) {
      this.messageCallbacks.splice(index, 1);
    }
  }

  /**
   * Subscribes to state change events
   *
   * @param callback - Function to call when the state changes
   */
  public onStateChange(callback: StateChangeCallback): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Removes a state change callback
   *
   * @param callback - The callback function to remove
   */
  public offStateChange(callback: StateChangeCallback): void {
    const index = this.stateChangeCallbacks.indexOf(callback);
    if (index !== -1) {
      this.stateChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Subscribes to become Chief events
   * Called when this tab becomes the Chief (leader)
   *
   * @param callback - Function to call when becoming Chief
   */
  public onBecomeChief(callback: LeadershipCallback): void {
    this.becomeChiefCallbacks.push(callback);
  }

  /**
   * Removes a become Chief callback
   *
   * @param callback - The callback function to remove
   */
  public offBecomeChief(callback: LeadershipCallback): void {
    const index = this.becomeChiefCallbacks.indexOf(callback);
    if (index !== -1) {
      this.becomeChiefCallbacks.splice(index, 1);
    }
  }

  /**
   * Subscribes to become Follower events
   * Called when this tab becomes a Follower (loses leadership)
   *
   * @param callback - Function to call when becoming Follower
   */
  public onBecomeFollower(callback: LeadershipCallback): void {
    this.becomeFollowerCallbacks.push(callback);
  }

  /**
   * Removes a become Follower callback
   *
   * @param callback - The callback function to remove
   */
  public offBecomeFollower(callback: LeadershipCallback): void {
    const index = this.becomeFollowerCallbacks.indexOf(callback);
    if (index !== -1) {
      this.becomeFollowerCallbacks.splice(index, 1);
    }
  }

  /**
   * Handles incoming messages from BroadcastChannel
   */
  private handleMessage(message: ChannelMessage): void {
    // Ignore messages from self (except for DATA which we already handle locally)
    if (message.senderId === this.tabId) {
      return;
    }

    switch (message.type) {
      case MessageType.HEARTBEAT:
        this.handleHeartbeat(message.senderId);
        break;

      case MessageType.ELECTION:
        this.handleElectionRequest(message.senderId, message.timestamp);
        break;

      case MessageType.ALIVE:
        this.handleAliveResponse(message.senderId, message.timestamp);
        break;

      case MessageType.VICTORY:
        this.handleVictory(message.senderId);
        break;

      case MessageType.DATA:
        this.notifyMessageCallbacks((message as DataMessage).payload);
        break;

      case MessageType.SHUTDOWN:
        this.handleShutdown(message.senderId);
        break;
    }
  }

  /**
   * Starts a new election
   */
  private startElection(): void {
    // Debounce rapid elections (e.g., from rapid tab reloading)
    if (this.electionDebounceTimer) {
      return;
    }

    this.electionDebounceTimer = setTimeout(() => {
      this.electionDebounceTimer = null;
    }, ELECTION_DEBOUNCE_TIME);

    this.setState(TabState.ELECTING);
    this.clearElectionTimer();

    // Broadcast election request
    this.broadcast({
      type: MessageType.ELECTION,
      senderId: this.tabId,
      timestamp: this.creationTimestamp,
    });

    // Set timeout - if no ALIVE response, declare victory
    this.electionTimer = setTimeout(() => {
      this.declareVictory();
    }, this.electionTimeout);
  }

  /**
   * Declares this tab as the new Chief
   */
  private declareVictory(): void {
    this.clearElectionTimer();
    this.setState(TabState.CHIEF);
    this.currentChiefId = this.tabId;

    // Broadcast victory
    this.broadcast({
      type: MessageType.VICTORY,
      senderId: this.tabId,
      timestamp: Date.now(),
    });

    // Start heartbeat
    this.startHeartbeat();

    // Run all exclusive tasks
    this.runAllTasks();
  }

  /**
   * Handles heartbeat from current Chief
   */
  private handleHeartbeat(senderId: string): void {
    if (this.state === TabState.CHIEF && senderId !== this.tabId) {
      // Another tab claims to be Chief - use tie-breaker
      if (this.shouldYieldTo(senderId, Date.now())) {
        this.becomeFollower(senderId);
      }
      return;
    }

    if (this.state === TabState.ELECTING || this.state === TabState.FOLLOWER) {
      this.currentChiefId = senderId;
      this.becomeFollower(senderId);
    }
  }

  /**
   * Handles election request from another tab
   */
  private handleElectionRequest(senderId: string, senderTimestamp: number): void {
    // If we have higher priority (older or smaller ID), respond with ALIVE
    if (!this.shouldYieldTo(senderId, senderTimestamp)) {
      this.broadcast({
        type: MessageType.ALIVE,
        senderId: this.tabId,
        timestamp: this.creationTimestamp,
      });

      // Start our own election if not already Chief
      if (this.state !== TabState.CHIEF) {
        this.startElection();
      }
    }
  }

  /**
   * Handles ALIVE response from another tab with higher priority
   */
  private handleAliveResponse(senderId: string, senderTimestamp: number): void {
    if (this.state === TabState.ELECTING) {
      // Someone with higher priority is alive, wait for their victory
      if (this.shouldYieldTo(senderId, senderTimestamp)) {
        this.clearElectionTimer();
        this.setState(TabState.FOLLOWER);
        this.resetElectionTimeout();
      }
    }
  }

  /**
   * Handles victory announcement from another tab
   */
  private handleVictory(senderId: string): void {
    if (senderId === this.tabId) {
      return;
    }

    if (this.state === TabState.CHIEF) {
      // Conflict - use tie-breaker
      if (this.shouldYieldTo(senderId, Date.now())) {
        this.becomeFollower(senderId);
      } else {
        // Re-declare our victory
        this.broadcast({
          type: MessageType.VICTORY,
          senderId: this.tabId,
          timestamp: Date.now(),
        });
      }
      return;
    }

    this.becomeFollower(senderId);
  }

  /**
   * Handles shutdown announcement from current Chief
   */
  private handleShutdown(senderId: string): void {
    if (senderId === this.currentChiefId) {
      // Chief is leaving, start new election
      this.currentChiefId = null;
      this.startElection();
    }
  }

  /**
   * Transitions this tab to Follower state
   */
  private becomeFollower(chiefId: string): void {
    const wasChief = this.state === TabState.CHIEF;

    this.setState(TabState.FOLLOWER);
    this.currentChiefId = chiefId;

    // Stop heartbeat if we were Chief
    this.stopHeartbeat();

    // Run cleanup if we lost leadership
    if (wasChief) {
      this.runCleanups();
    }

    // Reset election timeout
    this.resetElectionTimeout();
  }

  /**
   * Determines if this tab should yield to another tab
   * Based on creation timestamp (earlier wins) or UUID comparison (smaller wins)
   */
  private shouldYieldTo(otherId: string, otherTimestamp: number): boolean {
    // Earlier creation time wins
    if (otherTimestamp !== this.creationTimestamp) {
      return otherTimestamp < this.creationTimestamp;
    }
    // Tie-breaker: lexicographically smaller ID wins
    return otherId < this.tabId;
  }

  /**
   * Starts the heartbeat timer
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    // Send immediate heartbeat
    this.sendHeartbeat();

    // Set up interval
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  /**
   * Sends a single heartbeat
   */
  private sendHeartbeat(): void {
    this.broadcast({
      type: MessageType.HEARTBEAT,
      senderId: this.tabId,
      timestamp: Date.now(),
    });
  }

  /**
   * Stops the heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Resets the election timeout (for followers waiting for heartbeat)
   */
  private resetElectionTimeout(): void {
    this.clearElectionTimer();

    this.electionTimer = setTimeout(() => {
      // Chief seems dead, start new election
      this.currentChiefId = null;
      this.startElection();
    }, this.electionTimeout);
  }

  /**
   * Clears the election timer
   */
  private clearElectionTimer(): void {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = null;
    }
  }

  /**
   * Clears all timers
   */
  private clearTimers(): void {
    this.stopHeartbeat();
    this.clearElectionTimer();

    if (this.electionDebounceTimer) {
      clearTimeout(this.electionDebounceTimer);
      this.electionDebounceTimer = null;
    }
  }

  /**
   * Broadcasts a message to all tabs
   */
  private broadcast(message: BaseMessage): void {
    if (this.channel) {
      this.channel.postMessage(message);
    }
  }

  /**
   * Runs a single exclusive task and stores its cleanup function
   */
  private runTask(task: ExclusiveTask): void {
    try {
      const cleanup = task();
      if (typeof cleanup === 'function') {
        this.activeCleanups.push(cleanup);
      }
    } catch (error) {
      console.error('[TabChief] Error running exclusive task:', error);
    }
  }

  /**
   * Runs all registered exclusive tasks
   */
  private runAllTasks(): void {
    for (const task of this.exclusiveTasks) {
      this.runTask(task);
    }
  }

  /**
   * Runs all cleanup functions
   */
  private runCleanups(): void {
    for (const cleanup of this.activeCleanups) {
      try {
        cleanup();
      } catch (error) {
        console.error('[TabChief] Error running cleanup:', error);
      }
    }
    this.activeCleanups = [];
  }

  /**
   * Notifies all message callbacks
   */
  private notifyMessageCallbacks<T>(data: T): void {
    for (const callback of this.messageCallbacks) {
      try {
        callback(data);
      } catch (error) {
        console.error('[TabChief] Error in message callback:', error);
      }
    }
  }

  /**
   * Sets the state and triggers callbacks
   */
  private setState(newState: TabState): void {
    const oldState = this.state;
    if (oldState === newState) {
      return;
    }

    this.state = newState;

    // Notify state change callbacks
    this.notifyStateChangeCallbacks(newState, oldState);

    // Notify leadership callbacks
    if (newState === TabState.CHIEF && oldState !== TabState.CHIEF) {
      this.notifyBecomeChiefCallbacks();
    } else if (newState === TabState.FOLLOWER && oldState === TabState.CHIEF) {
      this.notifyBecomeFollowerCallbacks();
    }
  }

  /**
   * Notifies all state change callbacks
   */
  private notifyStateChangeCallbacks(newState: TabState, oldState: TabState): void {
    for (const callback of this.stateChangeCallbacks) {
      try {
        callback(newState, oldState);
      } catch (error) {
        console.error('[TabChief] Error in state change callback:', error);
      }
    }
  }

  /**
   * Notifies all become Chief callbacks
   */
  private notifyBecomeChiefCallbacks(): void {
    for (const callback of this.becomeChiefCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('[TabChief] Error in become Chief callback:', error);
      }
    }
  }

  /**
   * Notifies all become Follower callbacks
   */
  private notifyBecomeFollowerCallbacks(): void {
    for (const callback of this.becomeFollowerCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('[TabChief] Error in become Follower callback:', error);
      }
    }
  }

  /**
   * Handles the beforeunload event for graceful shutdown
   */
  private handleBeforeUnload(): void {
    if (this.state === TabState.CHIEF) {
      // Announce shutdown synchronously
      this.broadcast({
        type: MessageType.SHUTDOWN,
        senderId: this.tabId,
        timestamp: Date.now(),
      });
    }

    // Run cleanups
    this.runCleanups();
  }
}
