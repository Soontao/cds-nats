import { cwdRequireCDS, User } from "cds-internal-tool";
import { headers as MsgHeaders, Msg } from "nats";
import os from "os";
import { FatalError } from "./errors";
import { HeaderObject } from "./types";


/**
 * create a timer and wait it finished
 * 
 * @param timeout 
 * @returns 
 */
export async function sleep(timeout: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * create nats headers with plain object, without context
 * 
 * @param headers 
 * @returns 
 */
export function createNatsHeaders(headers: HeaderObject = {}) {
  const msgHeaders = MsgHeaders();
  for (const [key, value] of Object.entries(headers)) {
    msgHeaders.set(key, String(value));
  }
  return msgHeaders;
}

/**
 * nats header to plain object
 * 
 * @param msg 
 * @returns plain header
 */
export function toHeader(msg: Msg): HeaderObject {
  const headers: any = {};
  if (msg.headers !== undefined) {
    for (const key of msg.headers.keys()) {
      headers[key] = msg.headers.get(key);
    }
  }
  return headers;
}

export function extractUserAndTenant(headers: HeaderObject): { user: User, id: string, tenant?: string } {
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
 * create nats headers with context
 * 
 * @param headers 
 * @param event 
 * @returns 
 */
export function toNatsHeaders(headers: HeaderObject = {}, event?: string) {

  const msgHeaders = createNatsHeaders(headers);

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
    // @ts-ignore
    let className = cds.context?._?.user?.constructor?.name;
    if (className === undefined) className = "Anonymous";
    return className;
  });
  setIfNotExit("user-attributes", () => JSON.stringify(cds.context?.user ?? "{}"));
  if (cds.context?.tenant !== undefined) {
    setIfNotExit("tenant", () => cds.context?.tenant);
  }

  return msgHeaders;
}
