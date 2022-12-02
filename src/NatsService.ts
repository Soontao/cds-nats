/* eslint-disable max-len */
import { cwdRequireCDS, EventNames, Logger } from "cds-internal-tool";
import { connect as connectNats, JSONCodec, NatsConnection } from "nats";
import { NatsServiceOptions } from "./types";


/**
 * Nats Base Service
 */
export abstract class NatsService<O extends NatsServiceOptions = NatsServiceOptions> extends cwdRequireCDS().Service<EventNames, O> {

  protected nc!: NatsConnection;

  protected logger!: Logger;

  protected codec = JSONCodec<any>();

  async init(): Promise<any> {
    this.logger = cwdRequireCDS().log(`nats|${this.kind}`);
    this.logger.info("service", this.name, "kind", this.kind, "nats connecting");
    this.nc = await connectNats(this.options);
    this.logger.info("service", this.name, "kind", this.kind, "nats connected");
  }

  /**
   * disconnect from resource
   * 
   * @returns 
   */
  async disconnect() {
    try {
      return await this.nc?.close();
    } catch (err) {
      return this.logger.error("close nats client error", err);
    }
  }

}
