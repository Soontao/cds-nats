import { cwdRequireCDS, User } from "cds-internal-tool";
import { headers as MsgHeaders, JSONCodec, Msg } from "nats";
import os from "os";
import { FatalError } from "./errors";
import { NatsService } from "./NatsService";


interface HeaderObject {

  id?: string;
  type?: string;
  source?: string;
  time?: string;
  datacontenttype?: string;
  specversion?: string;
  tenant?: string;
  "user-class"?: string;
  "user-attributes"?: string;

  [key: string]: string | undefined

}

export class NatsMQBaseService extends NatsService {

  protected codec = JSONCodec<any>();

  // >> utils

  /**
   * convert nats `Headers` to general object
   * 
   * @param msg nats message
   * @returns 
   */
  protected _toHeader(msg: Msg): HeaderObject {
    const headers: any = {};
    if (msg.headers !== undefined) {
      for (const key of msg.headers.keys()) {
        headers[key] = msg.headers.get(key);
      }
    }
    return headers;
  }

  protected _extractUserAndTenant(headers: HeaderObject): { user: User, id: string, tenant?: string } {
    if ("user-class" in headers && "user-attributes" in headers) {
      const cds = cwdRequireCDS() as any;
      let user;
      const tenant = headers["tenant"]; // TODO: warn if undefined
      const className = headers["user-class"];
      const id = headers["id"] ?? cds.utils.uuid();
      const userAttrs = JSON.parse(headers["user-attributes"] ?? "{}");
      if (className !== undefined) {
        if (className === "User") {
          user = new cds.User(userAttrs);
        } else {
          user = new cds.User[className](userAttrs);
        }
      }
      return { user, tenant, id };
    } else {
      throw new FatalError("fatal: user context lost from mq");
    }
  }

  /**
   * convert `cds.Event` to nats `Headers`
   * 
   * @param headers 
   * @param event 
   * @returns 
   */
  protected _toNatsHeaders(headers: any = {}, event?: string) {

    const msgHeaders = MsgHeaders();

    for (const [key, value] of Object.entries(headers)) {
      msgHeaders.set(key, String(value));
    }

    const cds = cwdRequireCDS();

    function setIfNotExit(key: string, value: () => string) {
      if (!msgHeaders.has(key)) msgHeaders.set(key, value());
    }

    setIfNotExit("id", () => cds.context?.id ?? cds.utils.uuid());
    setIfNotExit("type", () => event ?? "unknown");
    setIfNotExit("source", () => `/default/community.cap/${os.hostname()}/${process.pid}`);
    setIfNotExit("time", () => new Date().toISOString());
    setIfNotExit("datacontenttype", () => "application/json");
    setIfNotExit("specversion", () => "1.0");
    setIfNotExit("user-class", () => {
      let className = cds.context?.user?.constructor?.name;
      if (className === undefined) className = "Anonymous";
      return className;
    });
    setIfNotExit("user-attributes", () => JSON.stringify(cds.context?.user ?? "{}"));
    if (cds.context?.tenant !== undefined) {
      setIfNotExit("tenant", () => cds.context?.tenant);
    }

    return msgHeaders;
  }
}
