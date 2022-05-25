import { ApplicationService, assert, cwdRequireCDS, Definition, Logger, TransactionMix, User } from "cds-internal-tool";
import { headers as MsgHeaders, JSONCodec, Msg, Subscription } from "nats";
import os from "os";
import process from "process";
import { FatalError } from "./errors";
import { NatsService } from "./NatsService";

/**
 * Messaging Service Implementation for NATS Broker
 * 
 * @see ref [NATS is a connective technology that powers modern distributed systems.](https://nats.io/)
 */
export class NatsMessagingService extends NatsService {

  private logger!: Logger;

  private codec = JSONCodec<any>(); // TODO: option for v8 codec

  async init(): Promise<any> {
    await super.init();
    const cds = cwdRequireCDS();
    this.logger = cds.log("nats|messaging");
    cds.on("subscribe", (srv, event) => {
      const eventDef = srv.events[event];
      if (srv instanceof cds.ApplicationService && eventDef !== undefined) this._subscribeEvent(srv, eventDef);
    });
  }

  private _subscribeEvent(srv: ApplicationService, def: Definition) {
    const options = this._toSubscribeOption(def);
    // for the queue group the options.queue is necessary
    // ref: https://github.com/nats-io/nats.js#queue-groups
    this.logger.debug(
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

  private async _handleInboundEvent(srv: ApplicationService, def: Definition, sub: Subscription) {
    // use the service local event name, otherwise, framework could not found the handlers
    const event = def.name.substring(srv.name.length + 1);
    for await (const msg of sub) {
      const data = this.codec.decode(msg.data);
      const headers: any = this._toHeader(msg);

      const { user, tenant, id } = this._extractUserAndTenant(headers);
      this.logger.debug(
        "receive event", def.name,
        "for service", srv.name,
        "subject is", sub.getSubject(),
        "tenant is", tenant,
      );
      const cds = cwdRequireCDS();
      const txSrv: ApplicationService & TransactionMix = cds.context = srv.tx({ tenant, user }) as any;
      try {
        // TODO: retry ?
        await txSrv.emit(new cds.Event({ event, user, tenant, data, headers, id }));
        await txSrv.commit();
      } catch (error) {
        await txSrv.rollback();
        this.logger.error(
          "emit event",
          def.name,
          "failed with error",
          error
        );
      }
    }
  }

  // TODO: use `on` to register listener dynamically

  public async emit(payload: { event: string; data?: any; headers?: any; }): Promise<this>;

  public async emit(event: string, data?: any, headers?: any): Promise<this>;

  public async emit(event: any, data?: any, headers?: any): Promise<this> {

    // outbound emit

    const msg: any = typeof event === "object" ? event : { event, data, headers };

    const target = this._prepareTarget(msg.event, false);

    const msgHeaders = this._toNatsHeaders(msg.headers, msg.event);

    this.nc.publish(target, this.codec.encode(msg.data), { headers: msgHeaders });

    await this.nc.flush();
    return this;
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

  private _extractUserAndTenant(headers: any): { user: User, id: string, tenant?: string } {
    if ("user-class" in headers && "user-attributes" in headers) {
      const cds = cwdRequireCDS() as any;
      let user;
      const tenant = headers["tenant"]; // TODO: warn if undefined
      const className = headers["user-class"];
      const id = headers["id"];
      const userAttrs = JSON.parse(headers["user-attributes"]);
      if (headers["user-class"] === "User") {
        user = new cds.User(userAttrs);
      } else {
        user = new cds.User[className](userAttrs);
      }
      return { user, tenant, id };
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

    setIfNotExit("id", () => cds.context?.id ?? cds.utils.uuid());
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

  /**
   * prepare target (nats subject) for publisher and listener
   * 
   * @param queueOrTopic 
   * @param inbound 
   * @returns 
   */
  private _prepareTarget(queueOrTopic: string, inbound: boolean) {
    let res = queueOrTopic;
    // TODO: transform invalid name
    if (!inbound && this.options.publishPrefix) res = this.options.publishPrefix + res;
    if (inbound && this.options.subscribePrefix) res = this.options.subscribePrefix + res;
    return res;
  }

  private _toSubscribeOption(eventDef: Definition) {
    let queueName = eventDef["@queue"];
    const topicName = eventDef["@topic"];

    if (queueName !== undefined && topicName !== undefined) {
      throw new FatalError(`for event ${eventDef.name}, both @queue and @topic provided, please remove one of them`);
    }

    if (queueName === undefined && topicName === undefined) {
      queueName = eventDef.name;
    }
    let options: { target: string, options?: any } = undefined as any;
    if (queueName !== undefined) {
      const normalizedQueueName = this._prepareTarget(queueName, true);
      options = {
        target: normalizedQueueName,
        options: { queue: normalizedQueueName }
      };
    }
    if (topicName !== undefined) {
      options = { target: this._prepareTarget(topicName, true) };
    }

    return options;

  }


  // << utils

  disconnect() {
    return this.nc?.close().catch(err => this.logger.error("close nats client error", err));
  }

}
