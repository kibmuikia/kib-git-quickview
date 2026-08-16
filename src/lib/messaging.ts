// file: src/lib/messaging.ts
/// <reference types="chrome" />

import type {
  ExtensionMessage,
  MessageResponseMap,
} from "../types/messages.ts";

/* --- Extension Message Helper --- */
export function sendExtensionMessage<T extends ExtensionMessage>(
  message: T,
): Promise<MessageResponseMap[T["type"]]> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        message,
        (response: MessageResponseMap[T["type"]] | undefined) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response) {
            reject(
              new Error(
                `No response received for message type "${message.type}"`,
              ),
            );
            return;
          }
          resolve(response);
        },
      );
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
