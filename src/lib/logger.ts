/**
 * @file src/lib/logger.ts
 * @description Centralized, structured logging utility with obfuscated module identifiers.
 *
 * Code-name Mapping (Security obfuscation):
 * - SW  => "KGQ-BG"  (Background Service Worker)
 * - SP  => "KGQ-UI"  (Side Panel UI)
 * - PU => "KGQ-POP" (Popup UI)
 * - OP => "KGQ-OPT" (Options Page)
 */
import { IS_DEV_MODE } from "./constants";

export type LogModuleCode =
  | "KGQ-BG" // Background Service Worker
  | "KGQ-BG-GH" // Background Service Worker - GitHub Service
  | "KGQ-POP" // Popup UI
  | "KGQ-OPT" // Options Page
  | "KGQ-GH-CLIENT" // GitHub Client
  | "KGQ-GH-PROFILE" // GitHub Profile Fetcher
  | "KGQ-GH-REPOS" // GitHub Repositories Fetcher
  | "KGQ-UI"; // Side Panel Dashboard UI

export interface LogOptions {
  module: LogModuleCode;
  scope?: string;
  data?: unknown;
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private minLevel: LogLevel = IS_DEV_MODE ? LogLevel.DEBUG : LogLevel.INFO;

  public setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private formatTag(module: LogModuleCode, scope?: string): string {
    return scope ? `[${module}:${scope}]` : `[${module}]`;
  }

  public debug(msg: string, options: LogOptions): void {
    if (this.minLevel > LogLevel.DEBUG) return;
    const tag = this.formatTag(options.module, options.scope);
    if (options.data !== undefined) {
      console.debug(tag, msg, options.data);
    } else {
      console.debug(tag, msg);
    }
  }

  public info(msg: string, options: LogOptions): void {
    if (this.minLevel > LogLevel.INFO) return;
    const tag = this.formatTag(options.module, options.scope);
    if (options.data !== undefined) {
      console.info(tag, msg, options.data);
    } else {
      console.info(tag, msg);
    }
  }

  public warn(msg: string, options: LogOptions): void {
    if (this.minLevel > LogLevel.WARN) return;
    const tag = this.formatTag(options.module, options.scope);
    if (options.data !== undefined) {
      console.warn(tag, msg, options.data);
    } else {
      console.warn(tag, msg);
    }
  }

  public error(msg: string, options: LogOptions): void {
    if (this.minLevel > LogLevel.ERROR) return;
    const tag = this.formatTag(options.module, options.scope);
    if (options.data !== undefined) {
      console.error(tag, msg, options.data);
    } else {
      console.error(tag, msg);
    }
  }
}

export const logger = new Logger();
