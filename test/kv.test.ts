import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import type NatsKVService from "../src/NatsKVService";
import { sleep } from "./utils";

describe("KV Test Suite", () => {

  const axios = setupTest(__dirname, "./app");

  if (process.env.ENABLE_JS == undefined) {
    it = it.skip
  }

  it("should find entity metadata", async () => {
    const response = await axios.get("/people/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/People/);
  });

  it('should support connect to kv service', async () => {
    const NatsKVService = require("../src/NatsKVService");
    const cds = cwdRequireCDS();
    const kv = await cds.connect.to("kv") as NatsKVService;
    expect(kv).toBeInstanceOf(NatsKVService)
  });


  afterAll(async () => {
    const cds = cwdRequireCDS();
    for (const srv of cds.services as any) { await srv?.disconnect?.() }
    await sleep(100)
  });

});
