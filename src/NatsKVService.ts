import { JSONCodec } from "nats";
import { KV, KvOptions } from "nats/lib/nats-base-client/types";
import { NatsService } from "./NatsService";

const DEFAULT_OPTIONS: Partial<KvOptions> = {
  history: 1,
};

/**
 * Nats KV Service
 * 
 * NOTICE, to use this feature, MUST [enable the jetstream feature](https://docs.nats.io/nats-concepts/jetstream/js_walkthrough#prerequisite-enabling-jetstream) on nats server firstly
 * 
 */
class NatsKVService extends NatsService {

  protected kv!: KV;

  protected codec = JSONCodec();

  protected ttl = -1;

  async init(): Promise<any> {
    await super.init();
    this.kv = await this.nc.jetstream().views.kv(
      this.options.kv ?? "default",
      Object.assign(
        {},
        DEFAULT_OPTIONS,
        this.options?.options ?? {}
      )
    );
    if (typeof this.options?.ttl === "number") {
      this.ttl = this.options.ttl;
    }
  }

  async set(k: string, v: any) {
    return this.kv.put(k, this.codec.encode(v), {});
  }

  async get(k: string) {
    const result = await this.kv.get(k);
    if (result === null || result?.length === 0) {
      return null;
    }
    if (this.ttl > 0) {
      if ((Date.now() - result.created.getTime()) > this.ttl) {
        return null;
      }
    }
    return this.codec.decode(result.value);
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

  async remove(k: string) {
    return this.kv.purge(k);
  }

}

export = NatsKVService
