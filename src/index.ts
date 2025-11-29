/**
 * tab-chief
 *
 * A lightweight, zero-dependency, framework-agnostic TypeScript library
 * for Leader Election in browser environments.
 *
 * @packageDocumentation
 */

// Re-export the main class
export { TabChief } from './core';

// Re-export types for consumers
export type {
  TabChiefOptions,
  CleanupFunction,
  ExclusiveTask,
  MessageCallback,
} from './types';

// Re-export enums
export { TabState, MessageType } from './types';
