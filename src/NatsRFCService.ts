/* eslint-disable @typescript-eslint/ban-ts-comment */
import { ApplicationService, cwdRequireCDS, TransactionMix } from "cds-internal-tool";
import { Msg, MsgHdrs, Subscription } from "nats";
import path from "path";
import process from "process";
import { RFCError } from "./errors";
import { NatsService } from "./NatsService";
import { NatsRFCServiceOptions, RFCInvocationInfo, RFCService } from "./types";
import { createNatsHeaders, extractUserAndTenant, toHeader, toNatsHeaders } from "./utils";


// TODO: single instance validation

/**
 * NatsRFCService
 * 
 * enable RFC/RPC capability for CAP/Nats
 */
class NatsRFCService extends NatsService<NatsRFCServiceOptions> {

  /**
   * the app name of current app
   */
  private appName!: string;

  /**
   * the queue group for current app
   */
  private appQueueGroup!: string;

  /**
   * request timeout
   */
  private timeout: number = 60 * 1000; // 1 minutes

  async init(): Promise<any> {
    await super.init();
    this.appName = this.options?.app?.name ?? path.basename(process.cwd());
    this.timeout = this.options?.invoke?.timeout ?? this.timeout;
    this.appQueueGroup = this._toAppQueueGroup(this.appName);
    this._listenServiceQueue();
  }

  private _toAppQueueGroup(serviceName: string) {
    return ["nats-rfc", this.options.prefix ?? "", serviceName].join("-");
  }

  private _listenServiceQueue() {
    const sub = this.nc.subscribe(this.appQueueGroup, { queue: this.appQueueGroup });
    this.logger.info("subscribe subject (Queue Group)", this.appQueueGroup, "for RFC");
    this
      ._handleInboundCall(sub)
      .catch(err => this.logger.error("receive error for subscription", "error", err));
  }

  private async _handleInboundCall(sub: Subscription) {
    for await (const msg of sub) {
      await this._handleInboundRequest(msg);
    }
  }

  private async _handleInboundRequest(msg: Msg) {
    const cds = cwdRequireCDS();
    try {
      const event: RFCInvocationInfo = this.codec.decode(msg.data);
      const headers = toHeader(msg);
      const { serviceName, methodName, args } = event;

      if (serviceName === undefined) {
        throw new Error(`service name is not found for subject ${msg.subject} sid ${msg.sid}`);
      }

      if (methodName === undefined) {
        throw new Error(`method name is not found for subject ${msg.subject} sid ${msg.sid}`);
      }

      const { user, tenant, id } = extractUserAndTenant(headers);
      const srv = await cds.connect.to(serviceName);

      // @ts-ignore
      if (typeof srv?.[methodName] !== "function") {
        throw new Error(
          `method/action/function '${methodName}' is not ` +
          `existed on the app service '${serviceName}'` +
          ` of app '${this.appName}'`
        );
      }

      cds.context = undefined as any;
      const tx: ApplicationService & TransactionMix = cds.context = srv.tx({
        tenant, user, id, headers
      } as any) as any;

      try {
        // @ts-ignore
        const response = await tx[methodName](...args);
        await tx.commit();
        msg.respond(this.codec.encode(response));
      }
      catch (error) {
        await tx.rollback();
        throw error;
      }
    }
    catch (error) {
      this.logger.error("process subject", msg.subject, "sid", msg.sid, "failed", error);
      const errorObject = { ...error };
      if ("message" in error) {
        errorObject["message"] = error["message"];
      }
      msg.respond(
        this.codec.encode(errorObject),
        {
          headers: createNatsHeaders({ "error": error instanceof Error ? "true" : "false", "throw": "true" })
        }
      );
    }
  }

  /**
   * execute invocation remotely 
   * 
   * @param appName remote app name
   * @param invocationInfo remote invocation info (full qualified name)
   * @throws {RFCError|object} remote thrown message
   * @returns result value from remote
   */
  public async execute(appName: string, invocationInfo: RFCInvocationInfo) {
    const msg = await this._execute(
      this._toAppQueueGroup(appName),
      invocationInfo,
      toNatsHeaders(),
    );

    // process error
    if (msg.headers?.get?.("throw") === "true") {
      const throwObject = this.codec.decode(msg.data);

      if (msg.headers?.get?.("error") === "true") {
        const error = new RFCError(
          throwObject?.message ?? "Unknown Error",
          appName
        );
        Object.assign(error, throwObject);
        throw error;
      }
      else {
        throw throwObject;
      }

    }
    return this.codec.decode(msg.data);
  }

  /**
   * create an application proxy 
   * 
   * @param appName 
   * @returns 
   */
  public app(appName: string) {
    return {
      /**
       * create a RFC service with limited methods
       * 
       * @param serviceName the service name in remote app
       * @returns {RFCService}
       */
      service: (serviceName: string): RFCService => new Proxy({}, {
        get: (_, prop) => {
          if (typeof prop === "string") {
            // emit/run/send
            const methodName = prop;
            return (...args: Array<any>) => {
              return this.execute(appName, { methodName, serviceName, args });
            };
          }
          // TODO: throw error
        }
      }) as any
    };

  }

  /**
   * nc request wrap
   * @param subject 
   * @param headers 
   * @param invocationInfo 
   * @returns 
   */
  private _execute(
    subject: string,
    data: RFCInvocationInfo,
    headers: MsgHdrs,
  ) {
    return this.nc.request(
      subject,
      this.codec.encode(data),
      {
        headers: headers,
        timeout: this.timeout,
      },
    );
  }

}

export = NatsRFCService
