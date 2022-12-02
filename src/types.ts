import { ApplicationService } from "cds-internal-tool";
import type { ConnectionOptions } from "nats";

export type ValueProvider<T> = (key: string) => Promise<T> | T

export type NatsServiceOptions = ConnectionOptions

export interface NatsMessagingServiceOptions extends NatsServiceOptions {
  publishPrefix?: string;
  subscribePrefix?: string;
}

export interface NatsKVServiceOptions extends NatsServiceOptions {
  ttl?: number;
  bucket?: string;
}

export interface NatsLockServiceOptions extends NatsKVServiceOptions {
  check?: {
    interval?: number;
  };
  lock?: {
    acquire?: number;
    timeout?: number;
  };
}

export interface NatsRFCServiceOptions extends NatsServiceOptions {
  prefix?: string;
  app?: {
    name?: string
  };
  invoke?: {
    timeout?: number;
  };
}

export interface HeaderObject {

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

export interface RFCInvocationInfo { serviceName: string, methodName: string, args: Array<any> }

export type RFCService<T extends ApplicationService = ApplicationService> = Pick<T, "emit" | "run" | "send"> & {
  /**
   * freestyle remote function, typically a custom function/action
   */
  [actionName: string]: (...args: Array<any>) => Promise<any>;
}
