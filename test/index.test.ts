/* eslint-disable @typescript-eslint/no-var-requires */
import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import type { NatsMessagingService } from "../src/NatsMessagingService";
import { sleep } from "./utils";

describe("Basic Test Suite", () => {

  const cds = cwdRequireCDS();
  const axios = setupTest(__dirname, "./app");

  it("should find entity metadata", async () => {
    const response = await axios.get("/people/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/People/);
  });

  it("should support publish event and process it (producer/consumer)", async () => {
    const messaging = await cds.connect.to("messaging") as NatsMessagingService;
    expect(messaging).toBeInstanceOf(require("../src/index"));
    const ID = cds.utils.uuid();

    let response = await axios.post("/people/People", { ID, Amount: 1 });
    expect(response.status).toBe(201);

    // @ts-ignore
    cds.context = { tenant: "tenant-1", user: new cds.User({ id: "theo sun" }) };

    await messaging.emit({
      event: "test.app.srv.theosun.PeopleService.changeAmount",
      data: { peopleID: ID, amount: 99.9 }
    });

    await sleep(1000);

    // verify data should be updated
    response = await axios.get(`/people/People(${ID})`);
    expect(response.status).toBe(200);
    expect(response.data.Amount).toBe(99.9);
    expect(response.data.modifiedBy).toBe("theo sun") // the user id should work
  });

  it('should support pub/sub mod', async () => {
    const messaging = await cds.connect.to("messaging") as NatsMessagingService;

    const ID = cds.utils.uuid();
    let response = await axios.post("/people/People", { ID, Amount: 1 });
    expect(response.status).toBe(201);

    // @ts-ignore
    cds.context = { tenant: "tenant-1", user: new cds.User({ id: "theo sun" }) };

    await messaging.emit({
      event: "test.app.srv.theosun.people.broadcast",
      data: { peopleID: ID, Name: "Theo New", Age: 28 }
    });

    await sleep(1000);

    response = await axios.get(`/people/People(${ID})`);
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ Name: "Theo New", Age: 28 })
  });

  afterAll(async () => {
    for (const srv of cds.services as any) { await srv?.disconnect?.() }
    await sleep(100)
  });

});
