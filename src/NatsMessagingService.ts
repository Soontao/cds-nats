import { ApplicationService, assert, cwdRequireCDS, Definition, Logger } from "cds-internal-tool";
import { connect as connectNats, headers as MsgHeaders, JSONCodec, Msg, NatsConnection, Subscription } from "nats";

/**
 * Messaging Service Implementation for NATS Broker
 * 
 * @see [NATS is a connective technology that powers modern distributed systems.](https://nats.io/)
 */
export class NatsMessagingService extends cwdRequireCDS().MessagingService {

  private logger!: Logger;

  private nc!: NatsConnection;

  private codec = JSONCodec<any>();

  async init(): Promise<any> {
    await super.init();
    const cds = cwdRequireCDS();
    this.logger = cds.log("nats|messaging");
    this.nc = await connectNats(this.options);
    cds.on("subscribe", (srv, event) => {
      const def = srv.events[event];
      if (srv instanceof cds.ApplicationService && def !== undefined) { this._onSubscribe(srv, def); }
    });
  }

  private _toSubscribeOption(def: Definition) {
    const options: { target: string, options?: any } = {
      // inbound target
      target: this.prepareTarget(def["@topic"] ?? def.name, true),
      options: undefined
    };

    if (def["@topic"] === undefined) {
      options.options = { queue: options.target };
    }

    return options;
  }

  private _onSubscribe(srv: ApplicationService, def: Definition) {
    const options = this._toSubscribeOption(def);
    // for the queue group the options.queue is necessary
    // ref: https://github.com/nats-io/nats.js#queue-groups
    this.logger.info(
      "subscribe event", def.name,
      "at service", srv.name,
      "with subject", options.target,
      "mode", options.options?.queue === undefined ? "Publish/Subscribe" : "Produce/Consume"
    );
    const sub = this.nc.subscribe(options.target, options.options);
    this
      ._handleSubscription(srv, def, sub)
      .catch(err => this.logger.error("receive error for subscription", def.name, "error", err));
  }

  private async _handleSubscription(srv: ApplicationService, def: Definition, sub: Subscription) {
    const eventName = def.name.substring(srv.name.length + 1);
    for await (const msg of sub) {
      // TODO: recover tenant/user
      const data = this.codec.decode(msg.data);
      const headers: any = this._toHeader(msg);
      this.logger.debug("receive event", def.name, "for service", srv.name, "subject is", sub.getSubject());
      try {
        await srv.emit(eventName, data, headers);
      } catch (error) {
        this.logger.error("emit event", def.name, "failed with error", error);
      }
    }
  }

  /**
   * to common header object
   * 
   * @param msg nats message
   * @returns 
   */
  private _toHeader(msg: Msg) {
    const headers: any = {};
    if (msg.headers !== undefined) {
      for (const key of msg.headers.keys()) {
        headers[key] = msg.headers.get(key);
      }
    }
    return headers;
  }

  public async publish(payload: { event: string; data?: any; headers?: any; }): Promise<void>;

  public async publish(event: string, data?: any, headers?: any): Promise<void>;

  public async publish(event: any, data?: any, headers?: any): Promise<void> {

    // outbound emit

    const msg: any = typeof event === "object" ? event : { event, data, headers };

    const target = this.prepareTarget(msg.event, false);

    const msgHeaders = this.prepareHeaders(msg.headers, msg.event);

    this.nc.publish(target, this.codec.encode(msg.data), { headers: msgHeaders });

    await this.nc.flush();
  }

  private prepareHeaders(headers: any = {}, event: string) {

    assert.mustNotNullOrUndefined(event);

    const msgHeaders = MsgHeaders();

    for (const [key, value] of Object.entries(headers)) {
      msgHeaders.set(key, String(value));
    }

    const cds = cwdRequireCDS();

    if (!msgHeaders.has("id")) msgHeaders.set("id", cds.utils.uuid());
    if (!msgHeaders.has("type")) msgHeaders.set("type", event);
    if (!msgHeaders.has("source")) msgHeaders.set("source", `/default/community.cap/${process.pid}`);
    if (!msgHeaders.has("time")) msgHeaders.set("time", new Date().toISOString());
    if (!msgHeaders.has("datacontenttype")) msgHeaders.set("datacontenttype", "application/json");
    if (!msgHeaders.has("specversion")) msgHeaders.set("specversion", "1.0");

    return msgHeaders;
  }


  private prepareTarget(topic: string, inbound: boolean) {
    let res = topic;
    if (!inbound && this.options.publishPrefix) res = this.options.publishPrefix + res;
    if (inbound && this.options.subscribePrefix) res = this.options.subscribePrefix + res;
    return res;
  }


  disconnect() {
    return this.nc?.close().catch(err => this.logger.error("close nats client error", err));
  }

}
