/* eslint-disable max-len */
import { cwdRequireCDS } from "cds-internal-tool";
import { sleep as Sleep } from "../src/utils";

export async function sleep(timeout = 1000) {
  return Sleep(timeout);
}

export async function beforeAllSetup() {
  await sleep(100);
}

export async function afterAllThings() {
  const cds = cwdRequireCDS();
  for (const srv of cds.services as any) {
    // clean all kv
    if (srv instanceof require("../src/NatsKVService")) { await srv.removeAll(); }
    // close connection
    await srv?.disconnect?.();
  }
  await sleep(100);
}
