import { ApplicationService, cwdRequireCDS, Definition, Service } from "cds-internal-tool";
import { Msg, MsgHdrs, Subscription } from "nats";
import { FatalError } from "./errors";
import { NatsService } from "./NatsService";
import { NatsMessagingServiceOptions } from "./types";
import { extractUserAndTenant, toHeader, toNatsHeaders } from "./utils";


/**
 * Messaging Service Implementation for NATS Broker
 * 
 * @see ref [NATS is a connective technology that powers modern distributed systems.](https://nats.io/)
 */
export class NatsMessagingService extends NatsService<NatsMessagingServiceOptions> {

  private registeredEvents = new Set<Definition>();

  async init(): Promise<any> {
    await super.init();
    const cds = cwdRequireCDS();
    cds.on("subscribe", this._onSubscribe.bind(this));
    // automatically connect to nats-rfc
    for (const [serviceName, config] of Object.entries<any>(cds.env.requires)) {
      if (config.kind === "nats-rfc") { await cds.connect.to(serviceName); }
    }
  }

  private _onSubscribe(srv: Service, event: string) {
    const cds = cwdRequireCDS();
    const eventDef = srv.events[event];
    if (srv instanceof cds.ApplicationService && eventDef !== undefined) this._subscribeEvent(srv, eventDef);
  }

  private _subscribeEvent(srv: ApplicationService, def: Definition) {

    if (this.registeredEvents.has(def)) {
      // avoid duplicate
      this.logger.warn("event", def.name, "has been registered before, skip");
      return;
    }

    this.registeredEvents.add(def);

    const options = this._toSubscribeOption(def);
    // for the queue group the options.queue is necessary
    // ref: https://github.com/nats-io/nats.js#queue-groups
    this.logger.info(
      "subscribe event", def.name,
      "at service", srv.name,
      "with subject", options.target,
      "mode", options.options?.queue === undefined ? "Publishe/Subscribe" : "Produce/Consume",
    );
    const sub = this.nc.subscribe(options.target, options.options);
    this
      ._handleInboundMessages(srv, def, sub)
      .catch(err => this.logger.error("receive error for subscription", def.name, "error", err));
  }

  private async _handleInboundMessages(srv: ApplicationService, def: Definition, sub: Subscription) {
    // use the service local event name, otherwise, framework could not found the handlers
    const event = def.name.substring(srv.name.length + 1);
    const subject = sub.getSubject();
    for await (const msg of sub) {
      await this._handleInboundMessage(msg, def, srv, subject, event);
    }
  }

  /**
   * handle each inbound message
   * 
   * @param msg 
   * @param def 
   * @param srv 
   * @param subject 
   * @param event 
   */
  private async _handleInboundMessage(
    msg: Msg,
    def: Definition,
    srv: ApplicationService,
    subject: string,
    event: string
  ) {
    try {
      const cds = cwdRequireCDS();
      const data = this.codec.decode(msg.data);
      const headers = toHeader(msg);

      const { user, tenant, id } = extractUserAndTenant(headers);
      this.logger.debug(
        "receive event", def.name,
        "for service", srv.name,
        "subject is", subject,
        "tenant is", tenant
      );
      try {
        await srv.tx({ tenant, user }, async (tx) => {
          await tx.emit(new cds.Event({ event, user, tenant, data, headers, id }));
        });
      }
      catch (error) {
        this.logger.error(
          "emit event",
          def.name,
          "failed with error",
          error
        );
      }
    } catch (error) {
      this.logger.error("process subject", msg.subject, "sid", msg.sid, "failed", error);
    }
  }

  // TODO: use `on` to register listener dynamically

  public async emit(payload: { event: string; data?: any; headers?: any; }): Promise<this>;

  public async emit(event: string, data?: any, headers?: any): Promise<this>;

  public async emit(event: any, data?: any, headers?: any): Promise<this> {
    // outbound emit
    const msg: any = typeof event === "object" ? event : { event, data, headers };
    const subject = this._prepareSubject(msg.event, false);
    const msgHeaders = toNatsHeaders(msg.headers, msg.event);
    this.logger.debug(
      "emit subject", subject,
      "with data", msg.data,
      "headers", msg.headers
    );
    await this._publish(subject, msg?.data, msgHeaders);
    return this;

  }


  /**
   * Nats internal publish function
   * 
   * @param subject 
   * @param data 
   * @param msgHeaders 
   */
  private async _publish(subject: string, data?: any, msgHeaders?: MsgHdrs) {
    this.nc.publish(
      subject,
      this.codec.encode(data),
      { headers: msgHeaders }
    );
    await this.nc.flush();
  }

  /**
   * prepare target (nats subject) for publisher and listener
   * 
   * @param queueOrTopic 
   * @param inbound 
   * @returns 
   */
  private _prepareSubject(queueOrTopic: string, inbound: boolean) {
    let res = queueOrTopic;
    // TODO: transform invalid name
    if (!inbound && this.options.publishPrefix) res = this.options.publishPrefix + res;
    if (inbound && this.options.subscribePrefix) res = this.options.subscribePrefix + res;
    return res;
  }

  private _toSubscribeOption(eventDef: Definition) {
    let queueName = eventDef["@queue"];
    let topicName = eventDef["@topic"];

    // with both annotation
    if (queueName !== undefined && topicName !== undefined) {
      throw new FatalError(`for event ${eventDef.name}, both @queue and @topic provided, please remove one of them`);
    }

    // without annotation
    if (queueName === undefined && topicName === undefined) {
      queueName = eventDef.name;
    }

    // with empty @queue annotation
    if (queueName === true) {
      queueName = eventDef.name;
    }

    // with empty @topic annotation
    if (topicName === true) {
      topicName = eventDef.name;
    }

    let options: { target: string, options?: any } = undefined as any;
    if (queueName !== undefined) {
      const normalizedQueueName = this._prepareSubject(queueName, true);
      options = {
        target: normalizedQueueName,
        options: { queue: normalizedQueueName }
      };
    }
    if (topicName !== undefined) {
      options = { target: this._prepareSubject(topicName, true) };
    }

    return options;

  }


  // << utils


}
