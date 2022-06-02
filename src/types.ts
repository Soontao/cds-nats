import { ApplicationService } from "cds-internal-tool";

export type ValueProvider<T> = (key: string) => Promise<T> | T
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
