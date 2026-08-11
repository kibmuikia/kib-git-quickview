/// <reference types="chrome" />

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
  | 'PING';

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
  | PingMessage;

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  rateLimit?: RateLimitInfo;
}
