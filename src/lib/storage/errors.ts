// file: src/lib/storage/errors.ts

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export class StorageReadError extends StorageError {
  constructor(key: string, cause?: unknown) {
    super(`Failed to read storage key '${key}'.`, cause);
    this.name = "StorageReadError";
  }
}

export class StorageWriteError extends StorageError {
  constructor(key: string, cause?: unknown) {
    super(`Failed to write storage key '${key}'.`, cause);
    this.name = "StorageWriteError";
  }
}
