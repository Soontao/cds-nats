import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import type NatsKVService from "../src/NatsKVService";
import { afterAllThings, beforeAllSetup, sleep } from "./utils";

describe("KV Test Suite", () => {

  const axios = setupTest(__dirname, "./app");

  beforeAll(beforeAllSetup);
  afterAll(afterAllThings);

  afterEach(async () => {
    const cds = cwdRequireCDS();
    const kv = await cds.connect.to("kv") as NatsKVService;
    const kv5000 = await cds.connect.to("kv5000") as NatsKVService;
    await kv.removeAll()
    await kv5000.removeAll()
  })

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

    const id = cds.utils.uuid()
    const v = await kv.get(id)
    expect(v).toBeNull()

    expect(await kv.keys()).toHaveLength(0)

    await kv.set(id, "v1")

    expect(await kv.keys()).toHaveLength(1)

    expect(await kv.get(id)).toBe("v1")
    await kv.set(id, "v2")
    expect(await kv.get(id)).toBe("v2")
    await kv.remove(id)
    expect(await kv.get(id)).toBeNull()
    expect(await kv.keys()).toHaveLength(0)

    expect(await kv.get("k3", () => "v4")).toBe("v4")
    expect(await kv.get("k3")).toBe("v4")

    await kv.removeAll()
  });


  it('should support ttl of values', async () => {
    const cds = cwdRequireCDS();
    const kv = await cds.connect.to("kv") as NatsKVService;
    const id = cds.utils.uuid()
    await kv.set(id, "v1")
    expect(await kv.get(id)).toBe("v1")
    await sleep(101) 
    expect(await kv.get(id)).toBeNull()
  });

  it('should support connect to multi instance', async () => {
    const cds = cwdRequireCDS();
    const kv5000 = await cds.connect.to("kv5000") as NatsKVService;
    expect(kv5000).not.toBeUndefined() // ttl of kv is 5000

    const id = cds.utils.uuid()
    await kv5000.set(id, "v1")
    expect(await kv5000.get(id)).toBe("v1")
    await sleep(101) // because in ./app/package.json we set ttl as 500
    expect(await kv5000.get(id)).toBe("v1")
  });

  it('should support set value after removeAll', async () => {
    const cds = cwdRequireCDS();
    const kv5000 = await cds.connect.to("kv5000") as NatsKVService;
    await kv5000.removeAll()
    const id = cds.utils.uuid()
    await kv5000.set(id, "v3")
    expect(await kv5000.get(id)).toBe("v3")
  });

});
