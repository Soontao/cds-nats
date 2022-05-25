import { cwdRequireCDS } from "cds-internal-tool";
import { connect as connectNats, NatsConnection } from "nats";


export abstract class NatsService extends cwdRequireCDS().Service {

  protected nc!: NatsConnection;

  async init(): Promise<any> { this.nc = await connectNats(this.options); }

}
