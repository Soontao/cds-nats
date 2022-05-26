import { cwdRequireCDS, Logger } from "cds-internal-tool";
import { connect as connectNats, NatsConnection } from "nats";


export abstract class NatsService extends cwdRequireCDS().Service {

  protected nc!: NatsConnection;

  protected logger!: Logger;

  async init(): Promise<any> {
    this.logger = cwdRequireCDS().log("nats|kv|messaging");
    this.nc = await connectNats(this.options);
  }

  disconnect() {
    return this.nc?.close().catch(err => this.logger.error("close nats client error", err));
  }

}
