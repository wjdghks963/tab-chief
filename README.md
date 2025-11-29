# tab-chief

A lightweight, zero-dependency, framework-agnostic TypeScript library for **Leader Election** in browser environments.

## Overview

`tab-chief` ensures that resource-heavy tasks (e.g., WebSocket connections, audio playback, background sync) are handled by a single "Chief" tab, while other tabs act as "Followers" receiving data updates. This prevents duplicate connections and resource waste when users have multiple tabs open.

## Features

- **Zero Dependencies** - No external runtime dependencies
- **Framework Agnostic** - Works with React, Vue, Angular, vanilla JS, or any other framework
- **TypeScript First** - Strict TypeScript types included
- **Effect Pattern** - Automatic cleanup when leadership changes
- **Event-Driven** - Built-in state change and leadership events
- **Memory Safe** - Event listener cleanup to prevent memory leaks
- **Multiple Formats** - Supports ESM, CJS, and IIFE (CDN)
- **Lightweight** - Minimal bundle size with tree-shaking support

## Installation

```bash
npm install tab-chief
```

```bash
yarn add tab-chief
```

```bash
pnpm add tab-chief
```

### CDN Usage

```html
<script src="https://unpkg.com/tab-chief/dist/index.iife.js"></script>
<script>
  const chief = new TabChief.TabChief();
</script>
```

## Quick Start

```typescript
import { TabChief } from 'tab-chief';

const chief = new TabChief();

// Register exclusive task (runs only on Chief tab)
chief.runExclusive(() => {
  const ws = new WebSocket('wss://example.com');

  ws.onmessage = (event) => {
    // Broadcast to all tabs
    chief.postMessage(JSON.parse(event.data));
  };

  // Return cleanup function
  return () => {
    ws.close();
  };
});

// Listen for messages (works on all tabs)
chief.onMessage((data) => {
  console.log('Received:', data);
});

// Start the election
chief.start();

// Stop when done (e.g., on component unmount)
// chief.stop();
```

## API Reference

### Constructor

```typescript
const chief = new TabChief(options?: TabChiefOptions);
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `channelName` | `string` | `'tab-chief-default'` | BroadcastChannel name for scoping |
| `heartbeatInterval` | `number` | `1000` | Heartbeat interval in ms |
| `electionTimeout` | `number` | `3000` | Time to wait before declaring victory |
| `debug` | `boolean` | `false` | Enable console logging for debugging |

### Methods

#### `start(): void`

Starts the election process. Call this after registering exclusive tasks.

```typescript
chief.start();
```

#### `stop(): void`

Stops the election, closes channels, and runs all cleanup functions.

```typescript
chief.stop();
```

#### `runExclusive(task: () => CleanupFunction | void): void`

Registers a task that runs **only** when this tab becomes the Chief. The task should return a cleanup function that executes when:
- Leadership is lost to another tab
- The tab is closed
- `stop()` is called

```typescript
chief.runExclusive(() => {
  // Setup code runs when becoming Chief
  const interval = setInterval(() => {
    chief.postMessage({ timestamp: Date.now() });
  }, 1000);

  // Cleanup runs when losing Chief status
  return () => {
    clearInterval(interval);
  };
});
```

#### `postMessage<T>(data: T): void`

Broadcasts a message to all tabs (including the sender).

```typescript
chief.postMessage({ type: 'UPDATE', payload: data });
```

#### `onMessage<T>(callback: (data: T) => void): void`

Subscribes to messages from the channel.

```typescript
chief.onMessage<{ type: string; payload: any }>((data) => {
  if (data.type === 'UPDATE') {
    updateUI(data.payload);
  }
});
```

#### `offMessage<T>(callback: (data: T) => void): void`

Removes a message callback to prevent memory leaks.

```typescript
const handler = (data) => console.log(data);
chief.onMessage(handler);

// Later, when no longer needed
chief.offMessage(handler);
```

#### `onStateChange(callback: (newState: TabState, oldState: TabState) => void): void`

Subscribes to state change events. Called whenever the tab's state changes.

```typescript
chief.onStateChange((newState, oldState) => {
  console.log(`State changed from ${oldState} to ${newState}`);
});
```

#### `offStateChange(callback: StateChangeCallback): void`

Removes a state change callback.

```typescript
const handler = (newState, oldState) => console.log(newState);
chief.onStateChange(handler);

// Later
chief.offStateChange(handler);
```

#### `onBecomeChief(callback: () => void): void`

Subscribes to leadership gain events. Called when this tab becomes the Chief.

```typescript
chief.onBecomeChief(() => {
  console.log('This tab is now the Chief!');
  showLeaderBadge();
});
```

#### `offBecomeChief(callback: LeadershipCallback): void`

Removes a become Chief callback.

#### `onBecomeFollower(callback: () => void): void`

Subscribes to leadership loss events. Called when this tab loses Chief status.

```typescript
chief.onBecomeFollower(() => {
  console.log('This tab is now a Follower');
  hideLeaderBadge();
});
```

#### `offBecomeFollower(callback: LeadershipCallback): void`

Removes a become Follower callback.

### Properties

#### `isChief: boolean`

Returns `true` if this tab is currently the Chief.

```typescript
if (chief.isChief) {
  console.log('This tab is the leader');
}
```

#### `currentState: TabState`

Returns the current state of the tab.

```typescript
import { TabState } from 'tab-chief';

console.log(chief.currentState); // 'IDLE' | 'ELECTING' | 'CHIEF' | 'FOLLOWER' | 'STOPPED'
```

#### `id: string`

Returns the unique identifier of this tab.

```typescript
console.log(chief.id); // 'lq8x2k-a1b2c3d4'
```

## Debugging

Enable debug mode to see detailed logs of the election process:

```typescript
const chief = new TabChief({
  channelName: 'my-app',
  debug: true  // Enable debug logging
});

chief.start();
```

Debug logs include:
- Election start and victory announcements
- Message sending and receiving (ELECTION, ALIVE, VICTORY, HEARTBEAT, SHUTDOWN)
- State transitions (IDLE → ELECTING → CHIEF/FOLLOWER)
- Priority comparisons and tie-breaking decisions
- Callback executions and task counts
- Conflict detection and resolution

Example console output:
```
[TabChief:lq8x2k-a] TabChief initialized { tabId: '...', channelName: 'my-app', ... }
[TabChief:lq8x2k-a] Starting TabChief
[TabChief:lq8x2k-a] Starting election { timeout: 3000 }
[TabChief:lq8x2k-a] Broadcasting ELECTION message
[TabChief:lq8x2k-a] State change: IDLE → ELECTING
[TabChief:lq8x2k-a] 🏆 Declaring victory - becoming Chief!
[TabChief:lq8x2k-a] State change: ELECTING → CHIEF
[TabChief:lq8x2k-a] Starting heartbeat { interval: 1000 }
```

## Use Cases

### WebSocket Connection Sharing

```typescript
const chief = new TabChief({ channelName: 'websocket-leader' });

chief.runExclusive(() => {
  const ws = new WebSocket('wss://api.example.com/realtime');

  ws.onopen = () => console.log('WebSocket connected');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    chief.postMessage(data);
  };

  ws.onerror = (error) => console.error('WebSocket error:', error);

  return () => {
    ws.close();
    console.log('WebSocket disconnected');
  };
});

chief.onMessage((data) => {
  // All tabs receive the data
  store.dispatch(updateData(data));
});

chief.start();
```

### Background Audio Player

```typescript
const chief = new TabChief({ channelName: 'audio-player' });

chief.runExclusive(() => {
  const audio = new Audio();

  chief.onMessage<{ action: string; src?: string }>((msg) => {
    if (msg.action === 'play' && msg.src) {
      audio.src = msg.src;
      audio.play();
    } else if (msg.action === 'pause') {
      audio.pause();
    }
  });

  return () => {
    audio.pause();
    audio.src = '';
  };
});

chief.start();

// Control from any tab
function playTrack(url: string) {
  chief.postMessage({ action: 'play', src: url });
}
```

### Polling / Background Sync

```typescript
const chief = new TabChief({ channelName: 'data-sync' });

chief.runExclusive(() => {
  const poll = async () => {
    const response = await fetch('/api/updates');
    const data = await response.json();
    chief.postMessage({ type: 'SYNC', data });
  };

  const interval = setInterval(poll, 30000);
  poll(); // Initial fetch

  return () => clearInterval(interval);
});

chief.onMessage((msg) => {
  if (msg.type === 'SYNC') {
    updateLocalCache(msg.data);
  }
});

chief.start();
```

## React Integration

### Using Event Listeners (Recommended)

```tsx
import { useEffect, useState, useRef } from 'react';
import { TabChief } from 'tab-chief';

function useTabChief(channelName: string) {
  const [isChief, setIsChief] = useState(false);
  const chiefRef = useRef<TabChief | null>(null);

  useEffect(() => {
    const chief = new TabChief({ channelName });
    chiefRef.current = chief;

    // Use event listeners for clean state management
    const handleBecomeChief = () => setIsChief(true);
    const handleBecomeFollower = () => setIsChief(false);

    chief.onBecomeChief(handleBecomeChief);
    chief.onBecomeFollower(handleBecomeFollower);

    chief.start();

    return () => {
      chief.offBecomeChief(handleBecomeChief);
      chief.offBecomeFollower(handleBecomeFollower);
      chief.stop();
    };
  }, [channelName]);

  return { isChief, chief: chiefRef.current };
}

// Usage
function App() {
  const { isChief, chief } = useTabChief('my-app');

  return (
    <div>
      <p>This tab is: {isChief ? 'Chief' : 'Follower'}</p>
    </div>
  );
}
```

### Using runExclusive Pattern

```tsx
import { useEffect, useState, useRef } from 'react';
import { TabChief } from 'tab-chief';

function useTabChief(channelName: string) {
  const [isChief, setIsChief] = useState(false);
  const chiefRef = useRef<TabChief | null>(null);

  useEffect(() => {
    const chief = new TabChief({ channelName });
    chiefRef.current = chief;

    chief.runExclusive(() => {
      setIsChief(true);
      return () => setIsChief(false);
    });

    chief.start();

    return () => chief.stop();
  }, [channelName]);

  return { isChief, chief: chiefRef.current };
}
```

## Vue Integration

### Using Event Listeners (Recommended)

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { TabChief } from 'tab-chief';

const isChief = ref(false);
let chief: TabChief;

onMounted(() => {
  chief = new TabChief({ channelName: 'my-vue-app' });

  const handleBecomeChief = () => { isChief.value = true; };
  const handleBecomeFollower = () => { isChief.value = false; };

  chief.onBecomeChief(handleBecomeChief);
  chief.onBecomeFollower(handleBecomeFollower);

  chief.start();
});

onUnmounted(() => {
  chief?.stop();
});
</script>

<template>
  <div>This tab is: {{ isChief ? 'Chief' : 'Follower' }}</div>
</template>
```

### Using runExclusive Pattern

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { TabChief } from 'tab-chief';

const isChief = ref(false);
let chief: TabChief;

onMounted(() => {
  chief = new TabChief({ channelName: 'my-vue-app' });

  chief.runExclusive(() => {
    isChief.value = true;
    return () => { isChief.value = false };
  });

  chief.start();
});

onUnmounted(() => {
  chief?.stop();
});
</script>

<template>
  <div>This tab is: {{ isChief ? 'Chief' : 'Follower' }}</div>
</template>
```

## How It Works

### Bully Algorithm

`tab-chief` implements a simplified [Bully Algorithm](https://en.wikipedia.org/wiki/Bully_algorithm) using `BroadcastChannel`:

1. **Election Start**: When a tab calls `start()`, it broadcasts an `ELECTION` message
2. **Priority Check**: Tabs with higher priority (earlier creation time) respond with `ALIVE`
3. **Victory**: If no higher-priority tab responds within the timeout, the tab declares victory
4. **Heartbeat**: The Chief broadcasts `HEARTBEAT` messages at regular intervals
5. **Failover**: If followers don't receive heartbeat within the timeout, they start a new election
6. **Graceful Shutdown**: When a Chief tab closes, it broadcasts `SHUTDOWN` to trigger immediate election

### Tie-Breaking

When multiple tabs claim leadership simultaneously:
1. **Creation Time**: The tab created earliest wins
2. **UUID Comparison**: If timestamps are equal, the lexicographically smaller ID wins

### Important Notes

- **Chief != Active Tab**: Leadership is independent of `document.visibilityState`. A background tab can remain Chief.
- **Persistent Leadership**: Focusing a tab does NOT trigger leadership change (for connection stability)
- **Graceful Degradation**: Leadership transfers cleanly when tabs close or reload

## Browser Support

`tab-chief` requires `BroadcastChannel` support:

- Chrome 54+
- Firefox 38+
- Safari 15.4+
- Edge 79+

For older browsers, consider using a polyfill or localStorage fallback (not included).

## Publishing to NPM

This package is configured for easy publishing to npm. Follow these steps:

### Prerequisites

1. Create an npm account at [npmjs.com](https://www.npmjs.com)
2. Login to npm in your terminal:
   ```bash
   npm login
   ```

### Publishing Steps

1. **Update version** (following [semver](https://semver.org/)):
   ```bash
   npm version patch  # 1.0.0 -> 1.0.1
   npm version minor  # 1.0.0 -> 1.1.0
   npm version major  # 1.0.0 -> 2.0.0
   ```

2. **Test the package** before publishing:
   ```bash
   npm run publish:dry
   ```
   This shows what would be published without actually publishing.

3. **Publish to npm**:
   ```bash
   npm run publish:npm
   ```
   Or directly:
   ```bash
   npm publish
   ```

The `prepublishOnly` script automatically runs type checking, tests, and builds before publishing to ensure quality.

### What Gets Published

Only the following are included in the npm package:
- `dist/` - Compiled JavaScript and TypeScript definitions
- `package.json` - Package metadata
- `README.md` - Documentation

Source files, tests, and configuration files are excluded via `.npmignore`.

## License

MIT
