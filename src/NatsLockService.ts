/* eslint-disable prefer-const */
import type { UnwrapPromise } from "@newdash/newdash";
import { cwdRequireCDS } from "cds-internal-tool";
import { NatsError, StringCodec } from "nats";
import { KvEntry } from "nats/lib/nats-base-client/types";
import { LockTimeoutError } from "./errors";
import NatsKVService from "./NatsKVService";
import { NatsLockServiceOptions } from "./types";
import { sleep } from "./utils";

const DEFAULT_LOCK_CHECK_INTERVAL = 100;

const DEFAULT_ACQ_TIMEOUT = 5 * 60 * 1000; // default acquire timeout, 5 minutes

const DEFAULT_LOCK_RESOURCE_TIMEOUT = 60 * 60 * 1000; // default resource could be keep in nats, 1 hour

/**
 * NatsLockService, provide a basic `distributed lock service` for CAP with Nats KV
 *
 * NOTICE, to use this feature, MUST [enable the jetstream feature](https://docs.nats.io/nats-concepts/jetstream/js_walkthrough#prerequisite-enabling-jetstream) on nats server firstly
 * 
 * **Concern about using queues to solve resource competition problems firstly**
 * 
 * @beta because Nats jetstream KV is beta status
 */
class NatsLockService extends NatsKVService<NatsLockServiceOptions, string> {

  private lockCheckInterval!: number;

  private lockDefaultAcquireTimeout!: number;

  async init(): Promise<void> {
    await super.init();
    this.codec = StringCodec(); // use string codec is enough
    this.lockCheckInterval = this.options?.check?.interval ?? DEFAULT_LOCK_CHECK_INTERVAL;
    this.lockDefaultAcquireTimeout = this.options?.lock?.acquire ?? DEFAULT_ACQ_TIMEOUT;
    this.ttl = this.options?.lock?.timeout ?? DEFAULT_LOCK_RESOURCE_TIMEOUT;
  }

  /**
   * lock resource by key, pending if resource not available, throw error if timeout
   * 
   * @param k the key of resource
   * @param acquireTimeout if the lock can not be retrieved in a specific time duration
   * @throws {LockTimeoutError} error thrown if timeout
   * @returns the unlock function, please **REMEMBER** unlock resource after use
   */
  public async lock(k: string, acquireTimeout?: number): Promise<() => Promise<void>> {
    return new Promise(async (resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;
      let finished = false;
      acquireTimeout = acquireTimeout ?? this.lockDefaultAcquireTimeout;

      if (acquireTimeout > 0) {
        timer = setTimeout(() => {
          this.logger.error("lock resource", k, "failed, timeout", acquireTimeout);
          finished = true;
          reject(new LockTimeoutError(k, acquireTimeout as number));
        }, acquireTimeout);
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
        this.logger.debug("acquire lock for", k, "successful");
        resolve(unlockFunc);
      };

      const rejectError = (error: Error) => {
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
        finished = true;
        this.logger.error("lock resource", k, "failed, error", error);
        reject(error);
      };

      try {
        if (v === null) {
          await this.kv.create(k, this.codec.encode(lockId));
          return resolveUnlockFunc();
        }
        if (this._isUnlockedOrLockTimeout(v)) {
          // is not locked, or remote lock timeout
          await this.kv.update(k, encodedLockId, v.revision);
          return resolveUnlockFunc();
        }

      } catch (error) {
        if (!this._isWrongSequence(error)) {
          return rejectError(error);
        }
      }

      for (; ;) {
        // forever loop, break on timeout or lock acquired
        await sleep(this.lockCheckInterval);
        if (finished) { break; }
        v = await this.kv.get(k) as KvEntry; // retrieve remote lock
        if (this._isUnlockedOrLockTimeout(v)) { // value is null
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

  private _isUnlockedOrLockTimeout(entry: KvEntry) {
    return entry.value.length === 0 || (entry.value.length > 0 && this._isTimeout(entry));
  }


  /**
   * synchronized execute logic cross instances
   * 
   * @param k key of locked resource
   * @param executor js executor, it will be execute directly when lock acquired
   * @returns 
   */
  public async synchronized<T = any>(k: string, executor: () => T): Promise<UnwrapPromise<T>> {
    const unlock = await this.lock(k);
    try {
      return await executor() as any;
    } catch (error) {
      throw error;
    } finally {
      await unlock(); // any case, unlock the resource
    }
  }


  /**
   * check the error is Nats Wrong Sequence Error
   * 
   * it means the resource has been changed by other client
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
   * @param k resource key
   * @param lockId the unique lockId, each lock will generate a unique id for that
   * @param force even the lock is not locked by this client, force unlock it
   */
  protected async unlock(k: string, lockId: string, force = false): Promise<void> {
    const remoteLockId = await this.kv.get(k);
    if (force === false) {
      if (remoteLockId === null || this._isUnlockedOrLockTimeout(remoteLockId)) {
        this.logger.debug(
          "unlock key", k,
          "but the key is not locked"
        );
        return;
      }
      if (this.codec.decode(remoteLockId.value) !== lockId) {
        this.logger.warn(
          "unlock key", k,
          "but the key is not locked by this session"
        );
        return;
      }
    }
    if (remoteLockId !== null) {
      return this.remove(k);
    }
  }

}

export = NatsLockService;
