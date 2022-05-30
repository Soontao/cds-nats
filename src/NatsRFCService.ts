/* eslint-disable @typescript-eslint/ban-ts-comment */
import { cwdRequireCDS } from "cds-internal-tool";
import { QueryObject } from "cds-internal-tool/lib/types/ql";
import { Subscription } from "nats";
import path from "path";
import process from "process";
import { NatsMQBaseService } from "./NatsMQBaseService";

const HEADER_SERVICE_NAME = "servicename";


export class NatsRFCService extends NatsMQBaseService {

  /**
   * the app name of current app
   */
  private appName!: string;

  private appQueueGroup!: string;

  async init(): Promise<any> {
    await super.init();
    if (this.options?.rfc?.enabled === true || this.options?.rfc?.enabled === "true") {
      this.logger.info("rfc service enabled");
      this.appName = this.options?.rfc?.name ?? path.basename(process.cwd());
      this.appQueueGroup = this._toAppQueueGroup(this.appName);
      this._listenServiceQueue();
    }
  }

  private _toAppQueueGroup(serviceName: string) {
    return [this.options.prefix ?? "", serviceName].join("");
  }

  private _listenServiceQueue() {
    const sub = this.nc.subscribe(this.appQueueGroup, { queue: this.appQueueGroup });
    this.logger.info("subscribe subject (Queue Group)", this.appQueueGroup, "for RFC");
    this
      ._handleInboundCall(sub)
      .catch(err => this.logger.error("receive error for subscription", "error", err));
  }

  private async _handleInboundCall(sub: Subscription) {
    // use the service local event name, otherwise, framework could not found the handlers
    const cds = cwdRequireCDS();
    for await (const msg of sub) {
      try {
        const query = this.codec.decode(msg.data);
        const headers = this._toHeader(msg);
        const serviceName = headers[HEADER_SERVICE_NAME];

        if (serviceName === undefined) {
          this.logger.error("service name is not found for subject", msg.subject, "sid", msg.sid);
          return;
        }

        const { user, tenant, id } = this._extractUserAndTenant(headers);
        const srv = await cds.connect.to(serviceName);
        // @ts-ignore
        const tx = cds.context = srv.tx({ tenant, user, id });

        try {
          const response = await tx.run(query);
          await tx.commit();
          msg.respond(this.codec.encode(response));
        }
        catch (error) {
          await tx.rollback();
        }
      }
      catch (error) {
        this.logger.error("process subject", msg.subject, "sid", msg.sid, "failed", error);
      }

    }
  }

  public async execute(appName: string, serviceName: string, query: QueryObject) {
    const msg = await this.nc.request(
      this._toAppQueueGroup(appName),
      this.codec.encode(query),
      {
        headers: this._toNatsHeaders({ [HEADER_SERVICE_NAME]: serviceName }),
        timeout: 60 * 1000, // TODO: options
      },
    );
    return this.codec.decode(msg.data);
  }

}

