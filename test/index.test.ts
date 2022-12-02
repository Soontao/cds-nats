/* eslint-disable @typescript-eslint/no-var-requires */
import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import { afterAllThings, beforeAllSetup, sleep } from "./utils";

describe("Basic Test Suite", () => {

  const cds = cwdRequireCDS();
  const axios = setupTest(__dirname, "./app");

  beforeAll(beforeAllSetup);
  afterAll(afterAllThings);


  it("should find entity metadata", async () => {
    const response = await axios.get("/people/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/People/);
  });

  it("should support publish event and process it (producer/consumer)", async () => {
    const messaging = await cds.connect.to("messaging")
    expect(messaging).toBeInstanceOf(require("../src/index"));
    const ID = cds.utils.uuid();

    let response = await axios.post("/people/People", { ID, Amount: 1 });
    expect(response.status).toBe(201);

    cds.context = undefined
    cds.context = { tenant: "tenant-1", user: new cds.User({ id: "theo sun" }) };

    await messaging.emit({
      event: "test.app.srv.theosun.PeopleService.changeAmount",
      data: { peopleID: ID, amount: 99.9 }
    });

    await sleep(100);

    // verify data should be updated
    response = await axios.get(`/people/People(${ID})`);
    expect(response.status).toBe(200);
    expect(response.data.Amount).toBe(99.9);
    expect(response.data.modifiedBy).toBe("theo sun") // the user id should work


    for (let idx = 0; idx < 15; idx++) {
      const randomValue = Math.round(Math.random() * 100)
      await sleep(100);
      // another event
      await messaging.emit({
        event: "test.app.srv.theosun.PeopleService.changeAmount",
        data: { peopleID: ID, amount: randomValue }
      });
      response = await axios.get(`/people/People(${ID})`);
      expect(response.status).toBe(200);
      expect(response.data.Amount).toBe(randomValue);
    }

  });

  it('should support pub/sub mod', async () => {
    const messaging = await cds.connect.to("messaging")

    const ID = cds.utils.uuid();
    let response = await axios.post("/people/People", { ID, Amount: 1 });
    expect(response.status).toBe(201);

    // @ts-ignore
    cds.context = { tenant: "tenant-1", user: new cds.User({ id: "theo sun" }) };

    await messaging.emit({
      event: "test.app.srv.theosun.people.broadcast",
      data: { peopleID: ID, Name: "Theo New", Age: 28 }
    });

    await sleep();

    response = await axios.get(`/people/People(${ID})`);
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ Name: "Theo New", Age: 28 })
  });


});
