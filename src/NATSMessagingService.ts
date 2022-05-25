import { cwdRequireCDS, Logger } from "cds-internal-tool";
import { connect as connectNats, NatsConnection } from "nats";

export class NATSMessagingService extends cwdRequireCDS().MessagingService {

  private logger!: Logger;

  private nc!: NatsConnection;

  async init(): Promise<any> {
    await super.init();
    const cds = cwdRequireCDS();
    this.logger = cds.log("nats|messaging");
    this.nc = await connectNats(this.options);
  }

}
