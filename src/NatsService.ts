import { cwdRequireCDS, Logger } from "cds-internal-tool";
import { connect as connectNats, JSONCodec, NatsConnection } from "nats";


/**
 * Nats Base Service
 */
export abstract class NatsService extends cwdRequireCDS().Service {

  protected nc!: NatsConnection;

  protected logger!: Logger;

  protected codec = JSONCodec<any>();

  async init(): Promise<any> {
    this.logger = cwdRequireCDS().log(`nats|${this.kind}`);
    this.nc = await connectNats(this.options);
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
