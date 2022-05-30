/* eslint-disable prefer-const */
import { cwdRequireCDS } from "cds-internal-tool";
import { NatsError } from "nats";
import { KvEntry } from "nats/lib/nats-base-client/types";
import { LockTimeoutError } from "./errors";
import NatsKVService from "./NatsKVService";
import { sleep } from "./utils";

const DEFAULT_LOCK_CHECK_INTERVAL = 100;

const DEFAULT_TIMEOUT = 5 * 60 * 1000;

class NatsLockService extends NatsKVService {

  private lockCheckInterval!: number;

  private lockDefaultTimeout!: number;

  async init(): Promise<void> {
    await super.init();
    this.lockCheckInterval = this.options?.check?.interval ?? DEFAULT_LOCK_CHECK_INTERVAL;
    this.lockDefaultTimeout = this.options?.lock?.timeout ?? DEFAULT_TIMEOUT;
  }

  /**
   * lock resource by key, pending if resource not available
   * 
   * @param k 
   * @param timeout if the lock can not be retrieved in a specific time duration
   * @returns the unlock function
   */
  public async lock(k: string, timeout?: number): Promise<() => Promise<void>> {
    return new Promise(async (resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;
      let finished = false;
      timeout = timeout ?? this.lockDefaultTimeout;
      if (timeout > 0) {
        timer = setTimeout(() => {
          finished = true;
          reject(new LockTimeoutError(`acquire lock failed ${k}`));
        }, timeout);
      }

      const lockId = cwdRequireCDS().utils.uuid();
      const encodedLockId = this.codec.encode(lockId);
      const unlockFunc = () => this.unlock(k, lockId);

      let v = await this.kv.get(k) as KvEntry;

      const resolveUnlockFunc = () => {
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
        finished = true;
        resolve(unlockFunc);
      };

      const rejectError = (error: Error) => {
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
        finished = true;
        reject(error);
      };

      try {
        if (v === null) {
          await this.kv.create(k, this.codec.encode(lockId));
          return resolveUnlockFunc();
        }
        if (v.value.length === 0) {
          await this.kv.update(k, encodedLockId, v.revision);
          return resolveUnlockFunc();
        }
      } catch (error) {
        if (!this._isWrongSequence(error)) {
          return rejectError(error);
        }
      }


      for (; ;) {
        await sleep(this.lockCheckInterval);
        if (finished) { break; }
        v = await this.kv.get(k) as KvEntry; // retrieve remote lock
        if (v.value.length === 0) { // value is null
          try {
            await this.kv.update(k, encodedLockId, v.revision); // use current version to lock, if other client lock it before, error will been thrown
            return resolveUnlockFunc(); // locked
          }
          catch (error) {
            // locked by other clients
            if (!this._isWrongSequence(error)) {
              return rejectError(error);
            }
          }
        }
      }

    });

  }

  /**
   * check the error is Nats Wrong Sequence Error
   * 
   * @param error 
   * @returns 
   */
  private _isWrongSequence(error: Error): boolean {
    if (error instanceof NatsError) {
      return error.api_error?.err_code === 10071;
    }
    return false;
  }

  /**
   * unlock resource by key
   * 
   * @param k 
   * @param lockId the unified lockId
   * @param force even the lock is not locked by this client, force unlock it
   */
  public async unlock(k: string, lockId: string, force = false): Promise<void> {
    const remoteLockId = await this.get(k);
    if (remoteLockId === null) {
      this.logger.debug(
        "unlock key", k,
        "but the key is not locked"
      );
      return;
    }
    if (lockId !== remoteLockId && force === false) {
      this.logger.warn(
        "unlock key", k,
        "but the key is locked by this session"
      );
      return;
    }
    return this.remove(k);
  }


}


export = NatsLockService
