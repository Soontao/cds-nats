
/**
 * nats fatal error
 */
export class FatalError extends Error { }

/**
 * cannot lock resource in a specific time
 */
export class LockTimeoutError extends Error {
  timeout: number;

  key: string;

  constructor(key: string, timeout: number) {
    super(`cannot acquire lock ${key} in ${timeout} ms`);
    this.key = key;
    this.timeout = timeout;
  }

}

/**
 * remote function call error
 */
export class RFCError extends Error {
  public app: string;

  constructor(msg: string, app: string) {
    super(msg);
    this.app = app;
  }
}
