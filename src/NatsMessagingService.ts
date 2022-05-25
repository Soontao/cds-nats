import { ApplicationService, assert, cwdRequireCDS, Definition, Logger, User } from "cds-internal-tool";
import { connect as connectNats, headers as MsgHeaders, JSONCodec, Msg, NatsConnection, Subscription } from "nats";
import os from "os";
import process from "process";
import { FatalError } from "./errors";

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
      const eventDef = srv.events[event];
      if (srv instanceof cds.ApplicationService && eventDef !== undefined) this._subscribeEvent(srv, eventDef);
    });
  }

  private async _handleInboundEvent(srv: ApplicationService, def: Definition, sub: Subscription) {
    // use the service local event name, otherwise, framework could not found the handlers
    const event = def.name.substring(srv.name.length + 1);
    for await (const msg of sub) {
      // TODO: recover tenant/user
      const data = this.codec.decode(msg.data);
      const headers: any = this._toHeader(msg);
      this.logger.debug("receive event", def.name, "for service", srv.name, "subject is", sub.getSubject());
      const { user, tenant } = this._extractUserAndTenant(headers);
      const cds = cwdRequireCDS();
      cds.context = { user, tenant }; // root transaction
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await srv.emit(new cds.Event({ event, user, tenant, data, headers }));
      } catch (error) {
        this.logger.error("emit event", def.name, "failed with error", error);
      }
    }
  }


  public async publish(payload: { event: string; data?: any; headers?: any; }): Promise<void>;

  public async publish(event: string, data?: any, headers?: any): Promise<void>;

  public async publish(event: any, data?: any, headers?: any): Promise<void> {

    // outbound emit

    const msg: any = typeof event === "object" ? event : { event, data, headers };

    const target = this.prepareTarget(msg.event, false);

    const msgHeaders = this._toNatsHeaders(msg.headers, msg.event);

    this.nc.publish(target, this.codec.encode(msg.data), { headers: msgHeaders });

    await this.nc.flush();
  }



  // >> utils

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

  private _extractUserAndTenant(headers: any): { user: User, tenant?: string } {
    if ("user-class" in headers && "user-attributes" in headers) {
      const cds = cwdRequireCDS() as any;
      let user;
      const tenant = headers["tenant"]; // TODO: warn if undefined
      const className = headers["user-class"];
      const userAttrs = JSON.parse(headers["user-attributes"]);
      if (headers["user-class"] === "User") {
        user = new cds.User(userAttrs);
      } else {
        user = new cds.User[className](userAttrs);
      }
      return { user, tenant };
    } else {
      throw new FatalError("fatal: user context lost from mq");
    }
  }

  private _toNatsHeaders(headers: any = {}, event: string) {

    assert.mustNotNullOrUndefined(event);

    const msgHeaders = MsgHeaders();

    for (const [key, value] of Object.entries(headers)) {
      msgHeaders.set(key, String(value));
    }

    const cds = cwdRequireCDS();

    function setIfNotExit(key: string, value: () => string) {
      if (!msgHeaders.has(key)) msgHeaders.set(key, value());
    }

    setIfNotExit("id", () => cds.utils.uuid());
    setIfNotExit("type", () => event);
    setIfNotExit("source", () => `/default/community.cap/${os.hostname()}/${process.pid}`);
    setIfNotExit("time", () => new Date().toISOString());
    setIfNotExit("datacontenttype", () => "application/json");
    setIfNotExit("specversion", () => "1.0");
    setIfNotExit("user-class", () => {
      let className = cds.context?.user?.constructor?.name;
      if (className === undefined) className = "Anonymous";
      return className;
    });
    setIfNotExit("user-attributes", () => JSON.stringify(cds.context?.user));
    if (cds.context?.tenant !== undefined) {
      setIfNotExit("tenant", () => cds.context?.tenant);
    }

    return msgHeaders;
  }

  private prepareTarget(topic: string, inbound: boolean) {
    let res = topic;
    if (!inbound && this.options.publishPrefix) res = this.options.publishPrefix + res;
    if (inbound && this.options.subscribePrefix) res = this.options.subscribePrefix + res;
    return res;
  }

  private _toSubscribeOption(eventDef: Definition) {
    const options: { target: string, options?: any } = {
      // inbound target
      target: this.prepareTarget(eventDef["@topic"] ?? eventDef.name, true),
      options: undefined
    };

    if (eventDef["@topic"] === undefined) {
      options.options = { queue: options.target };
    }

    return options;
  }

  private _subscribeEvent(srv: ApplicationService, def: Definition) {
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
      ._handleInboundEvent(srv, def, sub)
      .catch(err => this.logger.error("receive error for subscription", def.name, "error", err));
  }

  // << utils


  disconnect() {
    return this.nc?.close().catch(err => this.logger.error("close nats client error", err));
  }

}
