import { cwdRequireCDS } from "cds-internal-tool";
import { JSONCodec } from "nats";
import { KV, KvEntry, KvOptions } from "nats/lib/nats-base-client/types";
import { NatsService } from "./NatsService";
import { NatsKVServiceOptions, ValueProvider } from "./types";

const DEFAULT_OPTIONS: Partial<KvOptions> = { history: 1 };


/**
 * Nats KV Service
 * 
 * NOTICE, to use this feature, MUST [enable the jetstream feature](https://docs.nats.io/nats-concepts/jetstream/js_walkthrough#prerequisite-enabling-jetstream) on nats server firstly
 * 
 * @beta because Nats jetstream KV is beta status
 * 
 */
class NatsKVService<O extends NatsKVServiceOptions = NatsKVServiceOptions, V = any> extends NatsService<O> {

  protected codec = JSONCodec<V>();

  protected tenantsKV = new Map<string | undefined, KV | Promise<KV>>();

  protected ttl = -1;

  async init(): Promise<any> {
    await super.init();
    if (typeof this.options?.ttl === "number") {
      this.ttl = this.options.ttl;
    }
  }

  /**
   * tenant kv proxy
   */
  protected get kv(): KV {
    const cds = cwdRequireCDS();
    const tenant = cds?.context?.tenant;

    if (!this.tenantsKV.has(tenant)) {
      const bucket = `${this.options.bucket ?? this.name}_${String(tenant)}`;
      const options = Object.assign(
        {},
        DEFAULT_OPTIONS,
      );
      this.logger.debug(
        "connecting to nats kv bucket",
        bucket,
        "options",
        options,
        "for tenant",
        tenant
      );
      this.tenantsKV.set(tenant,
        this
          .nc
          .jetstream()
          .views
          .kv(bucket, options,)
          .then(kv => { this.tenantsKV.set(tenant, kv); return kv; })
      );
    }

    const kv = this.tenantsKV.get(tenant) as KV | Promise<KV>;

    if (kv instanceof Promise) {
      return new Proxy({}, {
        get: (_, prop) => {
          return async (...args: Array<any>) => {
            const iKv: any = await kv;
            return iKv[prop]?.(...args);
          };
        }
      }) as KV;
    }

    return kv;

  }

  /**
   * set value by key
   * 
   * @param k 
   * @param v 
   * @returns 
   */
  async set(k: string, v: V): Promise<void> {
    await this.kv.put(k, this.codec.encode(v), {});
  }

  /**
   * get value by key, null if not existed
   */
  async get(k: string, provider?: ValueProvider<V>): Promise<V | null> {
    if (provider !== undefined) {
      const value = await this.get(k);
      if (value !== null) { return value; }
      const newValue = await provider(k);
      if (newValue !== null) {
        await this.set(k, newValue);
      }
      return newValue;
    }
    const result = await this.kv.get(k);
    if (result === null || result?.length === 0) { return null; }
    if (this._isTimeout(result)) {
      return null;
    }
    return this.codec.decode(result.value);
  }

  /**
   * check entry is timeout or not
   * 
   * @param entry 
   * @returns 
   */
  protected _isTimeout(entry: KvEntry) {
    if (this.ttl > 0) {
      if ((Date.now() - entry.created.getTime()) > this.ttl) {
        return true;
      }
    }
    return false;
  }

  /**
   * list all keys
   * 
   * @returns 
   */
  async keys() {
    const ai = await this.kv.keys();
    const aKeys = new Array<string>();
    for await (const aKey of ai) {
      aKeys.push(aKey);
    }
    return aKeys;
  }

  /**
   * remove specific key from bucket
   * 
   * @param k 
   * @returns 
   */
  async remove(k: string) {
    return this.kv.purge(k);
  }

  /**
   * remove all keys from bucket
   */
  async removeAll() {
    for await (const key of await this.kv.keys()) {
      await this.remove(key);
    }
  }

}

export = NatsKVService
