/// <reference types="chrome" />
// file: src/types/messages.ts

/* Domain types — plain data shapes */

export interface ExtensionSettings {
  pat?: string;
  theme: 'dark' | 'light' | 'system';
  cacheTtlMinutes: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number; // Unix timestamp in seconds
}

export interface GitHubUserProfile {
  username: string;
  name: string;
  avatarUrl: string;
  bio: string;
  publicRepos: number;
  followers: number;
  following: number;
  company?: string;
  location?: string;
  blog?: string;
  htmlUrl: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  stargazersCount: number;
  forksCount: number;
  language: string | null;
  updatedAt: string;
}

/* --- Message Bus Payloads --- */

export type ExtensionMessageType =
  | 'FETCH_USER_PROFILE'
  | 'FETCH_USER_REPOS'
  | 'GET_RATE_LIMIT'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'CLEAR_CACHE'
  | 'GET_CURRENT_TARGET'
  | 'PING'; // A discriminated union of message types : This is the string literal that acts as the discriminant — the tag TypeScript uses to narrow which shape you're dealing with.

/* One interface per message, each with a type field matching one of those literals */

export interface FetchProfileMessage {
  type: 'FETCH_USER_PROFILE';
  payload: {
    username: string;
    forceRefresh?: boolean;
  };
}

export interface FetchReposMessage {
  type: 'FETCH_USER_REPOS';
  payload: {
    username: string;
    limit?: number;
    forceRefresh?: boolean;
  };
}

export interface GetRateLimitMessage {
  type: 'GET_RATE_LIMIT';
}

export interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

export interface SaveSettingsMessage {
  type: 'SAVE_SETTINGS';
  payload: Partial<ExtensionSettings>;
}

export interface ClearCacheMessage {
  type: 'CLEAR_CACHE';
}

/* Side-panel handoff — empty payload. The background stashes the most-recent
   successful (profile, repos) pair from the popup's FETCH_USER_* messages
   and returns them here. `username === null` means no popup search has
   succeeded yet this worker lifetime. */
export interface GetCurrentTargetMessage {
  type: 'GET_CURRENT_TARGET';
}

export interface PingMessage {
  type: 'PING';
}

export type ExtensionMessage =
  | FetchProfileMessage
  | FetchReposMessage
  | GetRateLimitMessage
  | GetSettingsMessage
  | SaveSettingsMessage
  | ClearCacheMessage
  | GetCurrentTargetMessage
  | PingMessage; // The union that ties it together : This is the key type. Any valid message in your system is one of these seven shapes, and — critically — TypeScript can narrow based on `.type`.

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  rateLimit?: RateLimitInfo;
} // A generic response envelope : Every response has the same envelope shape, but data is generic so each handler can return its own payload type.

/* Why the discriminated union matters (this is the whole point):
- Without it, chrome.runtime.sendMessage<M, R> gives you M = any, R = any — no safety at all. With it, you can narrow in a switch:
  ```typescript
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  switch (message.type) {
    case 'FETCH_USER_PROFILE':
      // TS knows message is FetchProfileMessage here
      // message.payload.username is valid, message.payload.limit would error
      fetchProfile(message.payload.username, message.payload.forceRefresh)
        .then((profile) => sendResponse({ success: true, data: profile } satisfies ExtensionResponse<GitHubUserProfile>))
        .catch((err) => sendResponse({ success: false, error: String(err) } satisfies ExtensionResponse));
      return true; // keep channel open for async sendResponse

    case 'FETCH_USER_REPOS':
      fetchRepos(message.payload.username, message.payload.limit)
        .then((repos) => sendResponse({ success: true, data: repos } satisfies ExtensionResponse<GitHubRepository[]>))
        .catch((err) => sendResponse({ success: false, error: String(err) } satisfies ExtensionResponse));
      return true;

    case 'GET_SETTINGS':
      getSettings().then((settings) =>
        sendResponse({ success: true, data: settings } satisfies ExtensionResponse<ExtensionSettings>)
      );
      return true;

    case 'PING':
      sendResponse({ success: true, data: 'pong' } satisfies ExtensionResponse<string>);
      return false; // synchronous, no need to keep channel open

    // ... other cases
  }
  });
  ```
  That return true is the classic MV3 gotcha — Chrome closes the message channel immediately unless the listener returns true to signal "I'll call sendResponse asynchronously."
*/

/* Bundled payload for GET_CURRENT_TARGET — the side-panel reads this to
   render header / repos grid without re-fetching. `profile` and `repos`
   are individually optional because a popup search that succeeded for
   profile but failed for repos will leave us with only `profile` cached. */
export interface CurrentTarget {
  username: string | null;
  profile?: GitHubUserProfile;
  repos?: GitHubRepository[];
}

export interface MessageResponseMap {
  FETCH_USER_PROFILE: ExtensionResponse<GitHubUserProfile>;
  FETCH_USER_REPOS: ExtensionResponse<GitHubRepository[]>;
  GET_RATE_LIMIT: ExtensionResponse<RateLimitInfo>;
  GET_SETTINGS: ExtensionResponse<ExtensionSettings>;
  SAVE_SETTINGS: ExtensionResponse<void>;
  CLEAR_CACHE: ExtensionResponse<void>;
  GET_CURRENT_TARGET: ExtensionResponse<CurrentTarget>;
  PING: ExtensionResponse<string>;
} // If you want end-to-end safety (send FetchProfileMessage, get back ExtensionResponse<GitHubUserProfile> inferred automatically), you'd build a mapped type linking each message type to its response type
