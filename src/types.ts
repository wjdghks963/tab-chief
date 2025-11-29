/**
 * Configuration options for TabChief instance
 */
export interface TabChiefOptions {
  /** Channel name for BroadcastChannel scope (default: 'tab-chief-default') */
  channelName?: string;
  /** Heartbeat interval in milliseconds (default: 1000ms) */
  heartbeatInterval?: number;
  /** Election timeout in milliseconds (default: 3000ms) */
  electionTimeout?: number;
}

/**
 * Cleanup function type for the Effect Pattern
 * Called when leadership is lost or the tab closes
 */
export type CleanupFunction = () => void;

/**
 * Task function type for runExclusive
 * Must return a cleanup function or void
 */
export type ExclusiveTask = () => CleanupFunction | void;

/**
 * Message callback function type
 */
export type MessageCallback<T> = (data: T) => void;

/**
 * State change callback function type
 * Called when the tab's state changes
 */
export type StateChangeCallback = (newState: TabState, oldState: TabState) => void;

/**
 * Leadership callback function type
 * Called when the tab becomes Chief or Follower
 */
export type LeadershipCallback = () => void;

/**
 * Internal message types for the election protocol
 */
export enum MessageType {
  /** Heartbeat from the current Chief */
  HEARTBEAT = 'HEARTBEAT',
  /** Election request from a tab wanting to become Chief */
  ELECTION = 'ELECTION',
  /** Victory announcement from new Chief */
  VICTORY = 'VICTORY',
  /** Alive response to election request */
  ALIVE = 'ALIVE',
  /** User data message */
  DATA = 'DATA',
  /** Graceful shutdown announcement */
  SHUTDOWN = 'SHUTDOWN',
}

/**
 * Base message structure for BroadcastChannel communication
 */
export interface BaseMessage {
  type: MessageType;
  senderId: string;
  timestamp: number;
}

/**
 * Heartbeat message from Chief
 */
export interface HeartbeatMessage extends BaseMessage {
  type: MessageType.HEARTBEAT;
}

/**
 * Election request message
 */
export interface ElectionMessage extends BaseMessage {
  type: MessageType.ELECTION;
}

/**
 * Victory announcement message
 */
export interface VictoryMessage extends BaseMessage {
  type: MessageType.VICTORY;
}

/**
 * Alive response message
 */
export interface AliveMessage extends BaseMessage {
  type: MessageType.ALIVE;
}

/**
 * User data message
 */
export interface DataMessage<T = unknown> extends BaseMessage {
  type: MessageType.DATA;
  payload: T;
}

/**
 * Shutdown announcement message
 */
export interface ShutdownMessage extends BaseMessage {
  type: MessageType.SHUTDOWN;
}

/**
 * Union type for all possible messages
 */
export type ChannelMessage<T = unknown> =
  | HeartbeatMessage
  | ElectionMessage
  | VictoryMessage
  | AliveMessage
  | DataMessage<T>
  | ShutdownMessage;

/**
 * Tab state enumeration
 */
export enum TabState {
  /** Initial state before start() is called */
  IDLE = 'IDLE',
  /** Participating in an election */
  ELECTING = 'ELECTING',
  /** Current tab is the Chief (leader) */
  CHIEF = 'CHIEF',
  /** Current tab is a Follower */
  FOLLOWER = 'FOLLOWER',
  /** Tab has been stopped */
  STOPPED = 'STOPPED',
}
