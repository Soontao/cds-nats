/* eslint-disable @typescript-eslint/no-var-requires */
import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import type { NatsMessagingService } from "../src/NatsMessagingService";
import { sleep } from "./utils";
describe("Demo Test Suite", () => {

  const cds = cwdRequireCDS();
  const axios = setupTest(__dirname, "./app");

  it("should find entity metadata", async () => {
    const response = await axios.get("/people/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/People/);
  });

  it("should support publish event and process it", async () => {
    const messaging = await cds.connect.to("messaging") as NatsMessagingService;
    expect(messaging).toBeInstanceOf(require("../src/index"));
    const ID = cds.utils.uuid();

    await axios.post("/people/People", { ID, Amount: 1 });

    await messaging.publish({
      event: "test.app.srv.theosun.PeopleService.changeAmount",
      data: { peopleID: "aacbaa16-8880-48f9-8792-30594d7ffc57", amount: 99.9 }
    });

    await sleep(500);
  });

  afterAll(async () => {
    const messaging = await cds.connect.to("messaging") as NatsMessagingService;
    await messaging.disconnect();
  });

});
